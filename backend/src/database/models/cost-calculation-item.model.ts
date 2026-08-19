import type { DuckDBDecimalValue } from "@duckdb/node-api";

import { parseFixedDecimal, serializeDecimal } from "@/modules/pricing/domain.js";

export interface CostCalculationItemRow {
  readonly generation_id: string;
  readonly observation_id: string;
  readonly session_id: string;
  readonly source_path: string;
  readonly source_identity: string;
  readonly source_record_number: bigint;
  readonly observed_model: string;
  readonly observation_time: Date | null;
  readonly canonical_model: string | null;
  readonly price_effective_from: Date | null;
  readonly price_effective_to: Date | null;
  readonly uncached_input_rate: DuckDBDecimalValue | null;
  readonly cached_input_rate: DuckDBDecimalValue | null;
  readonly output_rate: DuckDBDecimalValue | null;
  readonly uncached_input_tokens: bigint | null;
  readonly cached_input_tokens: bigint | null;
  readonly output_tokens: bigint | null;
  readonly uncached_input_cost_usd: DuckDBDecimalValue | null;
  readonly cached_input_cost_usd: DuckDBDecimalValue | null;
  readonly output_cost_usd: DuckDBDecimalValue | null;
  readonly estimated_cost_usd: DuckDBDecimalValue | null;
  readonly cost_complete: boolean;
  readonly gap_codes: string;
  readonly anomaly_codes: string;
}

export interface CostCalculationItem {
  readonly generationId: string;
  readonly observationId: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly sourceIdentity: string;
  readonly sourceRecordNumber: bigint;
  readonly observedModel: string;
  readonly observationTime: Date | null;
  readonly canonicalModel: string | null;
  readonly priceEffectiveFrom: Date | null;
  readonly priceEffectiveTo: Date | null;
  readonly uncachedInputRate: string | null;
  readonly cachedInputRate: string | null;
  readonly outputRate: string | null;
  readonly uncachedInputTokens: bigint | null;
  readonly cachedInputTokens: bigint | null;
  readonly outputTokens: bigint | null;
  readonly uncachedInputCostUsd: string | null;
  readonly cachedInputCostUsd: string | null;
  readonly outputCostUsd: string | null;
  readonly estimatedCostUsd: string | null;
  readonly costComplete: boolean;
  readonly gapCodes: readonly string[];
  readonly anomalyCodes: readonly string[];
}

export function mapCostCalculationItemRow(row: CostCalculationItemRow): CostCalculationItem {
  return {
    generationId: row.generation_id,
    observationId: row.observation_id,
    sessionId: row.session_id,
    sourcePath: row.source_path,
    sourceIdentity: row.source_identity,
    sourceRecordNumber: BigInt(row.source_record_number),
    observedModel: row.observed_model,
    observationTime: row.observation_time === null ? null : new Date(row.observation_time),
    canonicalModel: row.canonical_model,
    priceEffectiveFrom:
      row.price_effective_from === null ? null : new Date(row.price_effective_from),
    priceEffectiveTo: row.price_effective_to === null ? null : new Date(row.price_effective_to),
    uncachedInputRate: decimalString(row.uncached_input_rate),
    cachedInputRate: decimalString(row.cached_input_rate),
    outputRate: decimalString(row.output_rate),
    uncachedInputTokens: nullableBigInt(row.uncached_input_tokens),
    cachedInputTokens: nullableBigInt(row.cached_input_tokens),
    outputTokens: nullableBigInt(row.output_tokens),
    uncachedInputCostUsd: decimalString(row.uncached_input_cost_usd),
    cachedInputCostUsd: decimalString(row.cached_input_cost_usd),
    outputCostUsd: decimalString(row.output_cost_usd),
    estimatedCostUsd: decimalString(row.estimated_cost_usd),
    costComplete: row.cost_complete,
    gapCodes: JSON.parse(row.gap_codes) as string[],
    anomalyCodes: JSON.parse(row.anomaly_codes) as string[],
  };
}

function decimalString(value: DuckDBDecimalValue | null): string | null {
  return value === null ? null : serializeDecimal(parseFixedDecimal(String(value)));
}

function nullableBigInt(value: bigint | null): bigint | null {
  return value === null ? null : BigInt(value);
}
