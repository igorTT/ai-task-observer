import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapCheckpointRow,
  type CodexImportCheckpointRow,
} from "@/database/models/codex-import-checkpoint.model.js";
import type { ImportCheckpoint } from "@/modules/sessions/domain.js";

export type CheckpointWrite = Omit<ImportCheckpoint, "updatedAt">;

export class CodexCheckpointRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async find(sourcePath: string): Promise<ImportCheckpoint | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_import_checkpoints WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexImportCheckpointRow[])[0];
    return row ? mapCheckpointRow(row) : undefined;
  }

  public async upsert(checkpoint: CheckpointWrite): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_import_checkpoints (
        source_path, source_root, source_identity, committed_offset, observed_size,
        observed_modified_at_ms, parser_version, status, unknown_records,
        malformed_records, last_error
      ) VALUES ($path, $root, $identity, $offset, $size, $mtime, $version, $status, $unknown, $malformed, $error)
      ON CONFLICT (source_path) DO UPDATE SET
        source_root = excluded.source_root,
        source_identity = excluded.source_identity,
        committed_offset = excluded.committed_offset,
        observed_size = excluded.observed_size,
        observed_modified_at_ms = excluded.observed_modified_at_ms,
        parser_version = excluded.parser_version,
        status = excluded.status,
        unknown_records = excluded.unknown_records,
        malformed_records = excluded.malformed_records,
        last_error = excluded.last_error,
        updated_at = now()
    `);
    statement.bind({
      path: checkpoint.sourcePath,
      root: checkpoint.sourceRoot,
      identity: checkpoint.sourceIdentity,
      offset: checkpoint.committedOffset,
      size: checkpoint.observedSize,
      mtime: checkpoint.observedModifiedAtMs,
      version: checkpoint.parserVersion,
      status: checkpoint.status,
      unknown: checkpoint.unknownRecords,
      malformed: checkpoint.malformedRecords,
      error: checkpoint.lastError ?? null,
    });
    await statement.run();
  }

  public async list(): Promise<ImportCheckpoint[]> {
    const reader = await this.connection.runAndReadAll(
      "SELECT * FROM codex_import_checkpoints ORDER BY source_path",
    );
    return (reader.getRowObjects() as unknown as CodexImportCheckpointRow[]).map(mapCheckpointRow);
  }
}
