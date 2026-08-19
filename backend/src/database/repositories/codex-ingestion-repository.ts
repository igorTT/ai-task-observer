import type { DuckDBConnection } from "@duckdb/node-api";

import type { AppDatabase } from "@/database/database.js";
import { CodexCheckpointRepository } from "@/database/repositories/codex-checkpoint-repository.js";
import { CodexImportRunRepository } from "@/database/repositories/codex-import-run-repository.js";
import { CodexSessionEventRepository } from "@/database/repositories/codex-session-event-repository.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import { CodexSourceParseStateRepository } from "@/database/repositories/codex-source-parse-state-repository.js";
import { CodexUsageObservationRepository } from "@/database/repositories/codex-usage-observation-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import type { SessionAttribution } from "@/modules/linear/domain.js";
import type { SourceChunkMutation } from "@/modules/sessions/domain.js";

export class CodexIngestionRepository {
  public readonly sessions: CodexSessionRepository;
  public readonly usage: CodexSessionUsageRepository;
  public readonly events: CodexSessionEventRepository;
  public readonly observations: CodexUsageObservationRepository;
  public readonly parseStates: CodexSourceParseStateRepository;
  public readonly checkpoints: CodexCheckpointRepository;
  public readonly runs: CodexImportRunRepository;

  private readonly connection: DuckDBConnection;

  public constructor(private readonly database: AppDatabase) {
    this.connection = database.connection;
    this.sessions = new CodexSessionRepository(this.connection);
    this.usage = new CodexSessionUsageRepository(this.connection);
    this.events = new CodexSessionEventRepository(this.connection);
    this.observations = new CodexUsageObservationRepository(this.connection);
    this.parseStates = new CodexSourceParseStateRepository(this.connection);
    this.checkpoints = new CodexCheckpointRepository(this.connection);
    this.runs = new CodexImportRunRepository(this.connection);
  }

  public async applySourceChunk(chunk: SourceChunkMutation): Promise<Set<string>> {
    return this.database.exclusiveWrite(() => this.#applySourceChunk(chunk));
  }

  async #applySourceChunk(chunk: SourceChunkMutation): Promise<Set<string>> {
    const touched = new Set<string>([
      ...chunk.mutations.flatMap((mutation) => {
        const id = mutation.metadata?.sessionId ?? mutation.sessionId;
        return id ? [id] : [];
      }),
      ...chunk.events.map((event) => event.sessionId),
      ...chunk.observations.map((observation) => observation.sessionId),
    ]);
    const pathOwner = await this.sessions.findBySourcePath(chunk.sourcePath);
    if (pathOwner) touched.add(pathOwner.sessionId);
    const attributions = await this.#detachAttributions(touched);
    let transactionActive = false;
    try {
      await this.connection.run("BEGIN TRANSACTION");
      transactionActive = true;
      if (chunk.rebuild) {
        await this.events.deleteBySourcePath(chunk.sourcePath);
        await this.observations.deleteBySourcePath(chunk.sourcePath);
        await this.parseStates.delete(chunk.sourcePath);
      }

      if (pathOwner && pathOwner.sessionId !== chunk.parseState.sessionId) {
        await this.#releaseReplacedPath(pathOwner.sessionId, chunk.sourcePath);
        if (!(await this.sessions.findById(pathOwner.sessionId)))
          touched.delete(pathOwner.sessionId);
      } else if (
        chunk.rebuild &&
        pathOwner === undefined &&
        (await this.sessions.findById(chunk.parseState.sessionId))
      ) {
        await this.#removeRelocatedDuplicate(chunk);
      }

      for (const mutation of chunk.mutations) {
        const sessionId = mutation.metadata?.sessionId ?? mutation.sessionId;
        if (!sessionId) throw new Error("Normalized mutation is missing a session identity");
        if (mutation.metadata) {
          await this.sessions.upsert(mutation.metadata, chunk.parserVersion, "ready");
          await this.usage.ensure(sessionId);
        }
      }

      if (!(await this.sessions.findById(chunk.parseState.sessionId))) {
        throw new Error("Selected facts reference a session that has not been persisted");
      }
      for (const event of chunk.events) await this.events.insert(event);
      for (const observation of chunk.observations) await this.observations.insert(observation);
      await this.parseStates.upsert(chunk.parseState);

      for (const sessionId of touched) {
        const session = await this.sessions.findById(sessionId);
        if (!session) continue;
        const [events, observations] = await Promise.all([
          this.events.listBySessionId(sessionId),
          this.observations.listBySessionId(sessionId),
        ]);
        const developerTurns = BigInt(
          events.filter((event) => event.kind === "user_message").length,
        );
        const currentUsage = await this.usage.findBySessionId(sessionId);
        await this.usage.recompute(
          sessionId,
          observations,
          developerTurns,
          (currentUsage?.factRevision ?? 0n) + 1n,
        );
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
      transactionActive = false;
      await this.#restoreAttributions(attributions);
      return touched;
    } catch (error) {
      if (transactionActive) {
        try {
          await this.connection.run("ROLLBACK");
        } catch {
          // Preserve the original transaction failure.
        }
      }
      await this.#restoreAttributions(attributions);
      throw error;
    }
  }

  async #detachAttributions(sessionIds: ReadonlySet<string>): Promise<SessionAttribution[]> {
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
    await this.database.exclusiveWrite(async () => {
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
    });
  }

  async #deleteSession(sessionId: string): Promise<void> {
    for (const table of ["linear_session_attributions", "codex_session_usage", "codex_sessions"]) {
      const statement = await this.connection.prepare(
        `DELETE FROM ${table} WHERE session_id = $sessionId`,
      );
      statement.bind({ sessionId });
      await statement.run();
    }
  }

  async #releaseReplacedPath(sessionId: string, replacedPath: string): Promise<void> {
    const [remainingEvents, remainingObservations] = await Promise.all([
      this.events.listBySessionId(sessionId),
      this.observations.listBySessionId(sessionId),
    ]);
    const remainingPath =
      remainingEvents.find((event) => event.sourcePath !== replacedPath)?.sourcePath ??
      remainingObservations.find((observation) => observation.sourcePath !== replacedPath)
        ?.sourcePath;
    if (!remainingPath) {
      await this.#deleteSession(sessionId);
      return;
    }
    const statement = await this.connection.prepare(`
      UPDATE codex_sessions SET source_path = $remainingPath, updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({ sessionId, remainingPath });
    await statement.run();
  }

  async #removeRelocatedDuplicate(chunk: SourceChunkMutation): Promise<void> {
    const existing = await this.sessions.findById(chunk.parseState.sessionId);
    if (!existing || existing.sourcePath === chunk.sourcePath) return;
    const checkpoint = await this.checkpoints.find(existing.sourcePath);
    const existingPrefix = checkpoint ? sourcePrefix(checkpoint.sourceIdentity) : undefined;
    const replacementPrefix = sourcePrefix(chunk.sourceIdentity);
    if (!existingPrefix || !replacementPrefix || existingPrefix !== replacementPrefix) {
      return;
    }
    await this.events.deleteBySourcePath(existing.sourcePath);
    await this.observations.deleteBySourcePath(existing.sourcePath);
    await this.parseStates.delete(existing.sourcePath);
    await this.checkpoints.delete(existing.sourcePath);
  }
}

function sourcePrefix(identity: string): string | undefined {
  const parts = identity.split(":");
  return parts.length >= 3 ? parts[2] : undefined;
}
