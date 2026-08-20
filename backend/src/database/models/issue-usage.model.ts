import type { DuckDBDecimalValue } from "@duckdb/node-api";

import { parseFixedDecimal, serializeDecimal } from "@/modules/pricing/domain.js";

export interface IssueUsageMetricRow {
  readonly session_count: bigint;
  readonly developer_turns: bigint;
  readonly input_tokens: bigint | null;
  readonly cached_input_tokens: bigint | null;
  readonly output_tokens: bigint | null;
  readonly total_tokens: bigint | null;
  readonly estimated_cost_usd: DuckDBDecimalValue | null;
  readonly token_complete: boolean;
  readonly cost_complete: boolean;
  readonly anomaly_json_groups: string | null;
  readonly pricing_gap_json_groups: string | null;
  readonly uncovered_observation_count: bigint;
}

export interface IssueUsageMetrics {
  readonly sessionCount: bigint;
  readonly developerTurns: bigint;
  readonly inputTokens: bigint | null;
  readonly cachedInputTokens: bigint | null;
  readonly outputTokens: bigint | null;
  readonly totalTokens: bigint | null;
  readonly estimatedCostUsd: string | null;
  readonly tokenComplete: boolean;
  readonly costComplete: boolean;
  readonly anomalyCodes: readonly string[];
  readonly pricingGapCodes: readonly string[];
}

export interface IssueUsageSummaryRow extends IssueUsageMetricRow {
  readonly linear_id: string;
  readonly identifier: string;
  readonly issue_title: string;
  readonly issue_url: string;
}

export interface IssueUsageSummaryRecord {
  readonly linearId: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly metrics: IssueUsageMetrics;
}

export interface IssueUsageSessionRow extends IssueUsageMetricRow {
  readonly session_id: string;
  readonly session_title: string | null;
  readonly phase: string | null;
  readonly import_state: string;
  readonly last_error: string | null;
  readonly started_at: Date | null;
  readonly ended_at: Date | null;
}

export interface IssueUsageSessionRecord {
  readonly sessionId: string;
  readonly title: string | null;
  readonly phase: string | null;
  readonly importState: string;
  readonly lastError: string | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly metrics: IssueUsageMetrics;
}

export interface IssueUsageModelRow extends IssueUsageMetricRow {
  readonly model: string;
  readonly observed_models: string;
}

export interface IssueUsageModelRecord {
  readonly model: string;
  readonly observedModels: readonly string[];
  readonly metrics: IssueUsageMetrics;
}

export interface IssueUsageDailyRow extends IssueUsageMetricRow {
  readonly activity_date: Date | null;
}

export interface IssueUsageDailyRecord {
  readonly date: Date | null;
  readonly metrics: IssueUsageMetrics;
}

export function mapIssueUsageSummaryRow(row: IssueUsageSummaryRow): IssueUsageSummaryRecord {
  return {
    linearId: row.linear_id,
    identifier: row.identifier,
    title: row.issue_title,
    url: row.issue_url,
    metrics: mapIssueUsageMetrics(row),
  };
}

export function mapIssueUsageSessionRow(row: IssueUsageSessionRow): IssueUsageSessionRecord {
  return {
    sessionId: row.session_id,
    title: row.session_title,
    phase: row.phase,
    importState: row.import_state,
    lastError: row.last_error,
    startedAt: row.started_at === null ? null : new Date(row.started_at),
    endedAt: row.ended_at === null ? null : new Date(row.ended_at),
    metrics: mapIssueUsageMetrics(row),
  };
}

export function mapIssueUsageModelRow(row: IssueUsageModelRow): IssueUsageModelRecord {
  return {
    model: row.model,
    observedModels: row.observed_models
      .split("\n")
      .sort((left, right) => left.localeCompare(right)),
    metrics: mapIssueUsageMetrics(row),
  };
}

export function mapIssueUsageDailyRow(row: IssueUsageDailyRow): IssueUsageDailyRecord {
  return {
    date: row.activity_date === null ? null : new Date(row.activity_date),
    metrics: mapIssueUsageMetrics(row),
  };
}

export function mapIssueUsageMetrics(row: IssueUsageMetricRow): IssueUsageMetrics {
  const pricingGaps = parseJsonGroups(row.pricing_gap_json_groups);
  if (BigInt(row.uncovered_observation_count) > 0n) pricingGaps.add("uncovered_generation");
  return {
    sessionCount: BigInt(row.session_count),
    developerTurns: BigInt(row.developer_turns),
    inputTokens: nullableBigInt(row.input_tokens),
    cachedInputTokens: nullableBigInt(row.cached_input_tokens),
    outputTokens: nullableBigInt(row.output_tokens),
    totalTokens: nullableBigInt(row.total_tokens),
    estimatedCostUsd: decimalString(row.estimated_cost_usd),
    tokenComplete: row.token_complete,
    costComplete: row.cost_complete,
    anomalyCodes: [...parseJsonGroups(row.anomaly_json_groups)].sort(),
    pricingGapCodes: [...pricingGaps].sort(),
  };
}

function parseJsonGroups(groups: string | null): Set<string> {
  const values = new Set<string>();
  if (groups === null || groups.length === 0) return values;
  for (const group of groups.split("\n")) {
    for (const value of JSON.parse(group) as string[]) values.add(value);
  }
  return values;
}

function decimalString(value: DuckDBDecimalValue | null): string | null {
  return value === null ? null : serializeDecimal(parseFixedDecimal(String(value)));
}

function nullableBigInt(value: bigint | null): bigint | null {
  return value === null ? null : BigInt(value);
}
