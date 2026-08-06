import type { DuckDBConnection } from "@duckdb/node-api";

import { CodexCheckpointRepository } from "@/database/repositories/codex-checkpoint-repository.js";
import { CodexImportRunRepository } from "@/database/repositories/codex-import-run-repository.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import type { SourceChunkMutation } from "@/modules/sessions/domain.js";

export class CodexIngestionRepository {
  public readonly sessions: CodexSessionRepository;
  public readonly usage: CodexSessionUsageRepository;
  public readonly checkpoints: CodexCheckpointRepository;
  public readonly runs: CodexImportRunRepository;

  public constructor(private readonly connection: DuckDBConnection) {
    this.sessions = new CodexSessionRepository(connection);
    this.usage = new CodexSessionUsageRepository(connection);
    this.checkpoints = new CodexCheckpointRepository(connection);
    this.runs = new CodexImportRunRepository(connection);
  }

  public async applySourceChunk(chunk: SourceChunkMutation): Promise<Set<string>> {
    const touched = new Set<string>();
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
      return touched;
    } catch (error) {
      try {
        await this.connection.run("ROLLBACK");
      } catch {
        // Preserve the original transaction failure.
      }
      throw error;
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
