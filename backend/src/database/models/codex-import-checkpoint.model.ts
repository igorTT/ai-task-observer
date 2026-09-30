import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
import type { ImportCheckpoint, ImportState, RawTokenCounters } from "@/modules/sessions/domain.js";

export interface CodexImportCheckpointRow {
  readonly source_path: string;
  readonly source_root: string;
  readonly source_identity: string;
  readonly committed_offset: bigint;
  readonly observed_size: bigint;
  readonly parser_version: number;
  readonly session_id: string;
  readonly active_model: string;
  readonly normalization_epoch: number;
  readonly baseline_input: bigint | null;
  readonly baseline_cached_input: bigint | null;
  readonly baseline_output: bigint | null;
  readonly next_record_number: bigint;
  readonly status: ImportState;
  readonly unknown_records: number;
  readonly malformed_records: number;
  readonly last_error: string | null;
  readonly updated_at: DuckDBTimestampTZValue;
}

export function mapCheckpointRow(row: CodexImportCheckpointRow): ImportCheckpoint {
  const hasBaseline =
    row.baseline_input !== null ||
    row.baseline_cached_input !== null ||
    row.baseline_output !== null;
  const baseline: RawTokenCounters | null = hasBaseline
    ? {
        input: row.baseline_input === null ? null : BigInt(row.baseline_input),
        cachedInput: row.baseline_cached_input === null ? null : BigInt(row.baseline_cached_input),
        output: row.baseline_output === null ? null : BigInt(row.baseline_output),
      }
    : null;
  return {
    sourcePath: row.source_path,
    sourceRoot: row.source_root,
    sourceIdentity: row.source_identity,
    committedOffset: BigInt(row.committed_offset),
    observedSize: BigInt(row.observed_size),
    parserVersion: Number(row.parser_version),
    sessionId: row.session_id,
    activeModel: row.active_model,
    epoch: Number(row.normalization_epoch),
    baseline,
    nextRecordNumber: BigInt(row.next_record_number),
    status: row.status,
    unknownRecords: Number(row.unknown_records),
    malformedRecords: Number(row.malformed_records),
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    updatedAt: mapTimestampWithTimeZone(row.updated_at),
  };
}
