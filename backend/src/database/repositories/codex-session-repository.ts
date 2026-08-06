import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapSessionRow,
  type CodexSessionRecord,
  type CodexSessionRow,
} from "@/database/models/codex-session.model.js";
import type { SessionMetadataMutation, ImportState } from "@/modules/sessions/domain.js";

export class CodexSessionRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async upsert(
    metadata: SessionMetadataMutation,
    parserVersion: number,
    importState: ImportState = "ready",
  ): Promise<void> {
    const parameters = {
      sessionId: metadata.sessionId,
      sourceRoot: metadata.sourceRoot,
      sourcePath: metadata.sourcePath,
      title: metadata.title ?? null,
      startedAt: metadata.startedAt?.toISOString() ?? null,
      endedAt: metadata.endedAt?.toISOString() ?? null,
      state: importState,
      version: parserVersion,
    };
    const existing = await this.findById(metadata.sessionId);
    const statement = existing
      ? await this.connection.prepare(`
          UPDATE codex_sessions SET
            source_root = $sourceRoot,
            source_path = $sourcePath,
            current_title = coalesce($title, current_title),
            started_at = coalesce($startedAt, started_at),
            ended_at = coalesce($endedAt, ended_at),
            import_state = $state,
            parser_version = $version,
            last_error = NULL,
            updated_at = now()
          WHERE session_id = $sessionId
        `)
      : await this.connection.prepare(`
          INSERT INTO codex_sessions (
            session_id, source_root, source_path, current_title, started_at, ended_at,
            import_state, parser_version
          ) VALUES ($sessionId, $sourceRoot, $sourcePath, $title, $startedAt, $endedAt, $state, $version)
        `);
    statement.bind(parameters);
    await statement.run();
  }

  public async setImportState(
    sessionId: string,
    state: ImportState,
    sanitizedError?: string,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE codex_sessions
      SET import_state = $state, last_error = $error, updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({ sessionId, state, error: sanitizedError ?? null });
    await statement.run();
  }

  public async findById(sessionId: string): Promise<CodexSessionRecord | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_sessions WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexSessionRow[])[0];
    return row ? mapSessionRow(row) : undefined;
  }

  public async findBySourcePath(sourcePath: string): Promise<CodexSessionRecord | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_sessions WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexSessionRow[])[0];
    return row ? mapSessionRow(row) : undefined;
  }

  public async list(limit: number, offset: number): Promise<CodexSessionRecord[]> {
    const statement = await this.connection.prepare(`
      SELECT * FROM codex_sessions
      ORDER BY started_at DESC NULLS LAST, session_id ASC
      LIMIT $limit OFFSET $offset
    `);
    statement.bind({ limit, offset });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as CodexSessionRow[]).map(mapSessionRow);
  }

  public async count(): Promise<number> {
    const reader = await this.connection.runAndReadAll(
      "SELECT count(*) AS count FROM codex_sessions",
    );
    return Number((reader.getRowObjects() as Array<{ count: bigint }>)[0]?.count ?? 0n);
  }
}
