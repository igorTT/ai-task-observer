import type { DuckDBDecimalValue } from "@duckdb/node-api";

import { parseFixedDecimal, serializeDecimal } from "@/modules/pricing/domain.js";

export interface SessionCostSummaryRow {
  readonly session_id: string;
  readonly estimated_cost_usd: DuckDBDecimalValue | null;
  readonly cost_complete: boolean;
  readonly pricing_gap_json_groups: string | null;
  readonly uncovered_observation_count: bigint;
}

export interface SessionCostSummaryRecord {
  readonly sessionId: string;
  readonly estimatedCostUsd: string | null;
  readonly costComplete: boolean;
  readonly pricingGapCodes: readonly string[];
}

export function mapSessionCostSummaryRow(row: SessionCostSummaryRow): SessionCostSummaryRecord {
  const pricingGaps = parseJsonGroups(row.pricing_gap_json_groups);
  if (BigInt(row.uncovered_observation_count) > 0n) pricingGaps.add("uncovered_generation");
  return {
    sessionId: row.session_id,
    estimatedCostUsd:
      row.estimated_cost_usd === null
        ? null
        : serializeDecimal(parseFixedDecimal(String(row.estimated_cost_usd))),
    costComplete: row.cost_complete,
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
