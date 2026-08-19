import type {
  NormalizationMethod,
  UsageAnomalyCode,
  UsageObservation,
} from "@/modules/sessions/domain.js";

export interface CodexUsageObservationRow {
  readonly observation_id: string;
  readonly session_id: string;
  readonly source_path: string;
  readonly source_identity: string;
  readonly source_record_number: bigint;
  readonly parser_version: number;
  readonly model: string;
  readonly event_time: Date | null;
  readonly raw_cumulative_input: bigint | null;
  readonly raw_cumulative_cached_input: bigint | null;
  readonly raw_cumulative_output: bigint | null;
  readonly raw_last_input: bigint | null;
  readonly raw_last_cached_input: bigint | null;
  readonly raw_last_output: bigint | null;
  readonly normalized_input: bigint | null;
  readonly normalized_cached_input: bigint | null;
  readonly normalized_uncached_input: bigint | null;
  readonly normalized_output: bigint | null;
  readonly normalized_total: bigint | null;
  readonly normalization_epoch: number;
  readonly normalization_method: NormalizationMethod;
  readonly complete: boolean;
  readonly anomaly_codes: string;
  readonly legacy: boolean;
}

export function mapUsageObservationRow(row: CodexUsageObservationRow): UsageObservation {
  return {
    observationId: row.observation_id,
    sessionId: row.session_id,
    sourcePath: row.source_path,
    sourceIdentity: row.source_identity,
    sourceRecordNumber: BigInt(row.source_record_number),
    parserVersion: Number(row.parser_version),
    model: row.model,
    eventTime: row.event_time === null ? null : new Date(row.event_time),
    rawCumulative: rawCounters(
      row.raw_cumulative_input,
      row.raw_cumulative_cached_input,
      row.raw_cumulative_output,
    ),
    rawLast: rawCounters(row.raw_last_input, row.raw_last_cached_input, row.raw_last_output),
    normalized: {
      input: nullableBigInt(row.normalized_input),
      cachedInput: nullableBigInt(row.normalized_cached_input),
      uncachedInput: nullableBigInt(row.normalized_uncached_input),
      output: nullableBigInt(row.normalized_output),
      total: nullableBigInt(row.normalized_total),
    },
    epoch: Number(row.normalization_epoch),
    method: row.normalization_method,
    complete: row.complete,
    anomalyCodes: JSON.parse(row.anomaly_codes) as UsageAnomalyCode[],
    legacy: row.legacy,
  };
}

function rawCounters(input: bigint | null, cachedInput: bigint | null, output: bigint | null) {
  if (input === null && cachedInput === null && output === null) return null;
  return {
    input: nullableBigInt(input),
    cachedInput: nullableBigInt(cachedInput),
    output: nullableBigInt(output),
  };
}

function nullableBigInt(value: bigint | null): bigint | null {
  return value === null ? null : BigInt(value);
}
