export interface CodexSessionUsageRow {
  readonly session_id: string;
  readonly input_tokens: bigint;
  readonly cached_input_tokens: bigint;
  readonly output_tokens: bigint;
  readonly total_tokens: bigint;
  readonly usage_observed: boolean;
  readonly updated_at: Date;
}

export interface CodexSessionUsageRecord {
  readonly sessionId: string;
  readonly inputTokens: bigint;
  readonly cachedInputTokens: bigint;
  readonly outputTokens: bigint;
  readonly totalTokens: bigint;
  readonly usageObserved: boolean;
  readonly updatedAt: Date;
}

export function mapUsageRow(row: CodexSessionUsageRow): CodexSessionUsageRecord {
  return {
    sessionId: row.session_id,
    inputTokens: BigInt(row.input_tokens),
    cachedInputTokens: BigInt(row.cached_input_tokens),
    outputTokens: BigInt(row.output_tokens),
    totalTokens: BigInt(row.total_tokens),
    usageObserved: row.usage_observed,
    updatedAt: new Date(row.updated_at),
  };
}

export function jsonSafeCount(value: bigint): string {
  return value.toString(10);
}
