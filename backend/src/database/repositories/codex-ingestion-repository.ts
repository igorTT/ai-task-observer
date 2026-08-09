import type { DuckDBConnection } from "@duckdb/node-api";

import type { AppDatabase } from "@/database/database.js";
import { CodexCheckpointRepository } from "@/database/repositories/codex-checkpoint-repository.js";
import { CodexImportRunRepository } from "@/database/repositories/codex-import-run-repository.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import type { SessionAttribution } from "@/modules/linear/domain.js";
import type { SourceChunkMutation } from "@/modules/sessions/domain.js";

export class CodexIngestionRepository {
  public readonly sessions: CodexSessionRepository;
  public readonly usage: CodexSessionUsageRepository;
  public readonly checkpoints: CodexCheckpointRepository;
  public readonly runs: CodexImportRunRepository;

  private readonly connection: DuckDBConnection;

  public constructor(private readonly database: AppDatabase) {
    this.connection = database.connection;
    this.sessions = new CodexSessionRepository(this.connection);
    this.usage = new CodexSessionUsageRepository(this.connection);
    this.checkpoints = new CodexCheckpointRepository(this.connection);
    this.runs = new CodexImportRunRepository(this.connection);
  }

  public async applySourceChunk(chunk: SourceChunkMutation): Promise<Set<string>> {
    return this.database.exclusiveWrite(() => this.#applySourceChunk(chunk));
  }

  async #applySourceChunk(chunk: SourceChunkMutation): Promise<Set<string>> {
    const touched = new Set<string>();
    const detachedAttributions = await this.#detachAttributions(chunk);
    await this.connection.run("BEGIN TRANSACTION");
    try {
      if (chunk.rebuild) {
        const rebuiltSessionId = chunk.mutations.find((mutation) => mutation.metadata)?.metadata
          ?.sessionId;
        const pathOwner = await this.sessions.findBySourcePath(chunk.sourcePath);
        const identityOwner = rebuiltSessionId
          ? await this.sessions.findById(rebuiltSessionId)
          : undefined;
        if (pathOwner && rebuiltSessionId && pathOwner.sessionId !== rebuiltSessionId) {
          await this.#deleteSession(pathOwner.sessionId);
        }
        const existing =
          identityOwner ??
          (pathOwner?.sessionId === rebuiltSessionId || !rebuiltSessionId ? pathOwner : undefined);
        if (existing) {
          const resetSession = await this.connection.prepare(`
            UPDATE codex_sessions SET developer_turns = 0, import_state = 'importing', updated_at = now()
            WHERE session_id = $sessionId
          `);
          resetSession.bind({ sessionId: existing.sessionId });
          await resetSession.run();
          const resetUsage = await this.connection.prepare(`
            UPDATE codex_session_usage SET input_tokens = 0, cached_input_tokens = 0,
              output_tokens = 0, total_tokens = 0, usage_observed = false, updated_at = now()
            WHERE session_id = $sessionId
          `);
          resetUsage.bind({ sessionId: existing.sessionId });
          await resetUsage.run();
        }
      }

      for (const mutation of chunk.mutations) {
        const sessionId = mutation.metadata?.sessionId ?? mutation.sessionId;
        if (!sessionId) throw new Error("Normalized mutation is missing a session identity");
        touched.add(sessionId);
        if (mutation.metadata) {
          await this.sessions.upsert(mutation.metadata, chunk.parserVersion, "ready");
          await this.usage.ensure(sessionId);
        }
        if (mutation.developerTurnDelta !== undefined) {
          await this.usage.addDeveloperTurns(sessionId, mutation.developerTurnDelta);
        }
        if (mutation.tokenSnapshot)
          await this.usage.replaceTokens(sessionId, mutation.tokenSnapshot);
        if (mutation.tokenDelta) await this.usage.addTokens(sessionId, mutation.tokenDelta);
      }

      await this.checkpoints.upsert({
        sourcePath: chunk.sourcePath,
        sourceRoot: chunk.sourceRoot,
        sourceIdentity: chunk.sourceIdentity,
        committedOffset: chunk.committedOffset,
        observedSize: chunk.observedSize,
        observedModifiedAtMs: chunk.observedModifiedAtMs,
        parserVersion: chunk.parserVersion,
        status: "ready",
        unknownRecords: chunk.diagnostics.unknownRecords,
        malformedRecords: chunk.diagnostics.malformedRecords,
      });
      if (chunk.runId) {
        await this.runs.addProgress(chunk.runId, {
          filesImported: 1,
          sessionsImported: touched.size,
          warnings: chunk.diagnostics.warnings.length,
        });
      }
      await this.connection.run("COMMIT");
      await this.#restoreAttributions(detachedAttributions);
      return touched;
    } catch (error) {
      try {
        await this.connection.run("ROLLBACK");
      } catch {
        // Preserve the original transaction failure.
      }
      await this.#restoreAttributions(detachedAttributions);
      throw error;
    }
  }

  async #detachAttributions(chunk: SourceChunkMutation): Promise<SessionAttribution[]> {
    const sessionIds = new Set(
      chunk.mutations
        .map((mutation) => mutation.metadata?.sessionId ?? mutation.sessionId)
        .filter((sessionId): sessionId is string => sessionId !== undefined),
    );
    if (chunk.rebuild) {
      const pathOwner = await this.sessions.findBySourcePath(chunk.sourcePath);
      if (pathOwner) sessionIds.add(pathOwner.sessionId);
    }
    const repository = new LinearSessionAttributionRepository(this.connection);
    const attributions = (
      await Promise.all([...sessionIds].map((sessionId) => repository.findBySessionId(sessionId)))
    ).filter((attribution): attribution is SessionAttribution => attribution !== undefined);
    for (const attribution of attributions) {
      await repository.deleteBySessionId(attribution.sessionId);
    }
    return attributions;
  }

  async #restoreAttributions(attributions: readonly SessionAttribution[]): Promise<void> {
    const repository = new LinearSessionAttributionRepository(this.connection);
    for (const attribution of attributions) {
      if (await this.sessions.findById(attribution.sessionId)) await repository.save(attribution);
    }
  }

  public async markRebuildFailed(sourcePath: string, sanitizedError: string): Promise<void> {
    const existing = await this.sessions.findBySourcePath(sourcePath);
    if (existing) await this.sessions.setImportState(existing.sessionId, "stale", sanitizedError);
    const checkpoint = await this.checkpoints.find(sourcePath);
    if (checkpoint) {
      await this.checkpoints.upsert({
        ...checkpoint,
        status: "stale",
        lastError: sanitizedError,
      });
    }
  }

  async #deleteSession(sessionId: string): Promise<void> {
    const deleteAttribution = await this.connection.prepare(
      "DELETE FROM linear_session_attributions WHERE session_id = $sessionId",
    );
    deleteAttribution.bind({ sessionId });
    await deleteAttribution.run();
    const deleteUsage = await this.connection.prepare(
      "DELETE FROM codex_session_usage WHERE session_id = $sessionId",
    );
    deleteUsage.bind({ sessionId });
    await deleteUsage.run();
    const deleteSession = await this.connection.prepare(
      "DELETE FROM codex_sessions WHERE session_id = $sessionId",
    );
    deleteSession.bind({ sessionId });
    await deleteSession.run();
  }
}
