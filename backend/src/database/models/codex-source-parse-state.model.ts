import type { SourceParseState } from "@/modules/sessions/domain.js";

export interface CodexSourceParseStateRow {
  readonly source_path: string;
  readonly session_id: string;
  readonly source_identity: string;
  readonly parser_version: number;
  readonly active_model: string;
  readonly normalization_epoch: number;
  readonly baseline_input: bigint | null;
  readonly baseline_cached_input: bigint | null;
  readonly baseline_output: bigint | null;
  readonly next_record_number: bigint;
  readonly fact_revision: bigint;
}

export function mapSourceParseStateRow(row: CodexSourceParseStateRow): SourceParseState {
  const hasBaseline =
    row.baseline_input !== null ||
    row.baseline_cached_input !== null ||
    row.baseline_output !== null;
  return {
    sourcePath: row.source_path,
    sessionId: row.session_id,
    sourceIdentity: row.source_identity,
    parserVersion: Number(row.parser_version),
    activeModel: row.active_model,
    epoch: Number(row.normalization_epoch),
    baseline: hasBaseline
      ? {
          input: row.baseline_input === null ? null : BigInt(row.baseline_input),
          cachedInput:
            row.baseline_cached_input === null ? null : BigInt(row.baseline_cached_input),
          output: row.baseline_output === null ? null : BigInt(row.baseline_output),
        }
      : null,
    nextRecordNumber: BigInt(row.next_record_number),
    factRevision: BigInt(row.fact_revision),
  };
}
