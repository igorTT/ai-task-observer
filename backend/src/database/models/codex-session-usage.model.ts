export interface CodexSessionUsageRow {
  readonly session_id: string;
  readonly input_tokens: bigint | null;
  readonly cached_input_tokens: bigint | null;
  readonly uncached_input_tokens: bigint | null;
  readonly output_tokens: bigint | null;
  readonly total_tokens: bigint | null;
  readonly usage_observed: boolean;
  readonly input_complete: boolean;
  readonly cached_input_complete: boolean;
  readonly uncached_input_complete: boolean;
  readonly output_complete: boolean;
  readonly total_complete: boolean;
  readonly anomaly_codes: string;
  readonly fact_revision: bigint;
  readonly updated_at: Date;
}

export interface CodexSessionUsageRecord {
  readonly sessionId: string;
  readonly inputTokens: bigint | null;
  readonly cachedInputTokens: bigint | null;
  readonly uncachedInputTokens: bigint | null;
  readonly outputTokens: bigint | null;
  readonly totalTokens: bigint | null;
  readonly usageObserved: boolean;
  readonly completeness: {
    readonly input: boolean;
    readonly cachedInput: boolean;
    readonly uncachedInput: boolean;
    readonly output: boolean;
    readonly total: boolean;
  };
  readonly anomalyCodes: readonly string[];
  readonly factRevision: bigint;
  readonly updatedAt: Date;
}

export function mapUsageRow(row: CodexSessionUsageRow): CodexSessionUsageRecord {
  return {
    sessionId: row.session_id,
    inputTokens: nullableBigInt(row.input_tokens),
    cachedInputTokens: nullableBigInt(row.cached_input_tokens),
    uncachedInputTokens: nullableBigInt(row.uncached_input_tokens),
    outputTokens: nullableBigInt(row.output_tokens),
    totalTokens: nullableBigInt(row.total_tokens),
    usageObserved: row.usage_observed,
    completeness: {
      input: row.input_complete,
      cachedInput: row.cached_input_complete,
      uncachedInput: row.uncached_input_complete,
      output: row.output_complete,
      total: row.total_complete,
    },
    anomalyCodes: JSON.parse(row.anomaly_codes) as string[],
    factRevision: BigInt(row.fact_revision),
    updatedAt: new Date(row.updated_at),
  };
}

export function jsonSafeCount(value: bigint): string {
  return value.toString(10);
}

function nullableBigInt(value: bigint | null): bigint | null {
  return value === null ? null : BigInt(value);
}
