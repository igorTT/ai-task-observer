import type { ImportCheckpoint, ImportState } from "@/modules/sessions/domain.js";

export interface CodexImportCheckpointRow {
  readonly source_path: string;
  readonly source_root: string;
  readonly source_identity: string;
  readonly committed_offset: bigint;
  readonly observed_size: bigint;
  readonly observed_modified_at_ms: bigint;
  readonly parser_version: number;
  readonly status: ImportState;
  readonly unknown_records: number;
  readonly malformed_records: number;
  readonly last_error: string | null;
  readonly updated_at: Date;
}

export function mapCheckpointRow(row: CodexImportCheckpointRow): ImportCheckpoint {
  return {
    sourcePath: row.source_path,
    sourceRoot: row.source_root,
    sourceIdentity: row.source_identity,
    committedOffset: BigInt(row.committed_offset),
    observedSize: BigInt(row.observed_size),
    observedModifiedAtMs: BigInt(row.observed_modified_at_ms),
    parserVersion: Number(row.parser_version),
    status: row.status,
    unknownRecords: Number(row.unknown_records),
    malformedRecords: Number(row.malformed_records),
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    updatedAt: new Date(row.updated_at),
  };
}
