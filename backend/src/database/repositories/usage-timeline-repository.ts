import type {
  DuckDBConnection,
  DuckDBDecimalValue,
  DuckDBTimestampTZValue,
} from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
import { parseFixedDecimal, addDecimals, serializeDecimal } from "@/modules/pricing/domain.js";
import type {
  UsageTimelineAggregateRecord,
  UsageTimelineBucketRecord,
  UsageTimelineMetricRecord,
  UsageTimelineSessionPhase,
  UsageTimelineWindow,
} from "@/modules/usage-timeline/domain.js";

interface UsageTimelineFactRow {
  readonly event_time: DuckDBTimestampTZValue;
  readonly normalized_input: bigint | null;
  readonly normalized_cached_input: bigint | null;
  readonly normalized_uncached_input: bigint | null;
  readonly normalized_output: bigint | null;
  readonly normalized_total: bigint | null;
  readonly observation_complete: boolean;
  readonly observation_anomaly_codes: string;
  readonly estimated_cost_usd: DuckDBDecimalValue | null;
  readonly item_cost_complete: boolean | null;
  readonly pricing_gap_codes: string | null;
  readonly generation_covered: boolean;
}

interface UsageTimelineFact {
  readonly eventTime: Date;
  readonly normalizedInput: bigint | null;
  readonly normalizedCachedInput: bigint | null;
  readonly normalizedUncachedInput: bigint | null;
  readonly normalizedOutput: bigint | null;
  readonly normalizedTotal: bigint | null;
  readonly observationComplete: boolean;
  readonly observationWarningCodes: readonly string[];
  readonly estimatedCostUsd: string | null;
  readonly itemCostComplete: boolean;
  readonly pricingGapCodes: readonly string[];
  readonly generationCovered: boolean;
}

export class UsageTimelineRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async query(
    window: UsageTimelineWindow,
    generationId?: string,
    sessionPhase?: UsageTimelineSessionPhase,
  ): Promise<UsageTimelineAggregateRecord> {
    const [facts, unknownTimeObservationCount] = await Promise.all([
      this.listFacts(window, generationId, sessionPhase),
      this.countUnknownTimeObservations(sessionPhase),
    ]);
    const buckets = buildBuckets(window, facts);
    return {
      totals: metrics(facts),
      buckets,
      unknownTimeObservationCount,
    };
  }

  async listFacts(
    window: UsageTimelineWindow,
    generationId?: string,
    sessionPhase?: UsageTimelineSessionPhase,
  ): Promise<UsageTimelineFact[]> {
    const statement = await this.connection.prepare(`
      SELECT
        o.event_time,
        o.normalized_input,
        o.normalized_cached_input,
        o.normalized_uncached_input,
        o.normalized_output,
        o.normalized_total,
        o.complete AS observation_complete,
        o.anomaly_codes AS observation_anomaly_codes,
        ci.estimated_cost_usd,
        ci.cost_complete AS item_cost_complete,
        ci.gap_codes AS pricing_gap_codes,
        ci.observation_id IS NOT NULL AS generation_covered
      FROM codex_usage_observations o
      LEFT JOIN session_phase_assignments spa
        ON spa.session_id = o.session_id
      LEFT JOIN cost_calculation_items ci
        ON ci.generation_id = $generationId
        AND ci.observation_id = o.observation_id
      WHERE o.event_time IS NOT NULL
        AND o.event_time >= CAST($startAt AS TIMESTAMPTZ)
        AND o.event_time < CAST($endAt AS TIMESTAMPTZ)
        AND (
          $sessionPhase IS NULL
          OR ($sessionPhase = 'unassigned' AND spa.session_id IS NULL)
          OR ($sessionPhase <> 'unassigned' AND spa.phase = $sessionPhase)
        )
      ORDER BY o.event_time ASC, o.observation_id ASC
    `);
    statement.bind({
      generationId: generationId ?? null,
      sessionPhase: sessionPhase ?? null,
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
    });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as UsageTimelineFactRow[]).map(mapFact);
  }

  private async countUnknownTimeObservations(
    sessionPhase?: UsageTimelineSessionPhase,
  ): Promise<bigint> {
    const statement = await this.connection.prepare(`
      SELECT count(*)::BIGINT AS count
      FROM codex_usage_observations o
      LEFT JOIN session_phase_assignments spa
        ON spa.session_id = o.session_id
      WHERE o.event_time IS NULL
        AND (
          $sessionPhase IS NULL
          OR ($sessionPhase = 'unassigned' AND spa.session_id IS NULL)
          OR ($sessionPhase <> 'unassigned' AND spa.phase = $sessionPhase)
        )
    `);
    statement.bind({ sessionPhase: sessionPhase ?? null });
    const reader = await statement.runAndReadAll();
    return BigInt((reader.getRowObjects() as Array<{ count: bigint }>)[0]?.count ?? 0n);
  }
}

function buildBuckets(
  window: UsageTimelineWindow,
  facts: readonly UsageTimelineFact[],
): UsageTimelineBucketRecord[] {
  const buckets: UsageTimelineBucketRecord[] = [];
  let startAt = window.startAt;
  let factIndex = 0;
  while (startAt < window.endAt) {
    const nextClockBoundary = Math.ceil(startAt.getTime() / HOUR_MS) * HOUR_MS;
    const endAt = new Date(
      Math.min(
        window.endAt.getTime(),
        nextClockBoundary > startAt.getTime() ? nextClockBoundary : startAt.getTime() + HOUR_MS,
      ),
    );
    const bucketFacts: UsageTimelineFact[] = [];
    while (factIndex < facts.length && facts[factIndex]!.eventTime < endAt) {
      const fact = facts[factIndex]!;
      if (fact.eventTime >= startAt) bucketFacts.push(fact);
      factIndex += 1;
    }
    buckets.push({ startAt, endAt, ...metrics(bucketFacts) });
    startAt = endAt;
  }
  return buckets;
}

function metrics(facts: readonly UsageTimelineFact[]): UsageTimelineMetricRecord {
  const empty = facts.length === 0;
  const tokenComplete = empty || facts.every(hasCompleteTokens);
  const knownCost = facts
    .map((fact) => fact.estimatedCostUsd)
    .filter((value): value is string => value !== null);
  const costComplete =
    empty ||
    facts.every(
      (fact) => fact.generationCovered && fact.itemCostComplete && fact.estimatedCostUsd !== null,
    );
  const warningCodes = new Set<string>();
  for (const fact of facts) {
    for (const code of fact.observationWarningCodes) warningCodes.add(code);
    for (const code of fact.pricingGapCodes) warningCodes.add(code);
    if (!fact.generationCovered) warningCodes.add("uncovered_generation");
  }
  if (!tokenComplete && facts.length > 0) warningCodes.add("incomplete_tokens");
  if (!costComplete && facts.length > 0 && knownCost.length === 0) {
    warningCodes.add("cost_unavailable");
  }
  return {
    totalTokens: tokenComplete ? sumTokens(facts) : null,
    estimatedCostUsd: empty ? "0" : sumCosts(knownCost),
    tokenComplete,
    costComplete,
    warnings: [...warningCodes].sort(),
  };
}

function hasCompleteTokens(fact: UsageTimelineFact): boolean {
  return (
    fact.observationComplete &&
    fact.normalizedInput !== null &&
    fact.normalizedCachedInput !== null &&
    fact.normalizedUncachedInput !== null &&
    fact.normalizedOutput !== null &&
    fact.normalizedTotal !== null
  );
}

function sumTokens(facts: readonly UsageTimelineFact[]): bigint {
  return facts.reduce((sum, fact) => sum + (fact.normalizedTotal ?? 0n), 0n);
}

function sumCosts(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  return serializeDecimal(addDecimals(values.map(parseFixedDecimal)));
}

function mapFact(row: UsageTimelineFactRow): UsageTimelineFact {
  return {
    eventTime: mapTimestampWithTimeZone(row.event_time),
    normalizedInput: nullableBigInt(row.normalized_input),
    normalizedCachedInput: nullableBigInt(row.normalized_cached_input),
    normalizedUncachedInput: nullableBigInt(row.normalized_uncached_input),
    normalizedOutput: nullableBigInt(row.normalized_output),
    normalizedTotal: nullableBigInt(row.normalized_total),
    observationComplete: row.observation_complete,
    observationWarningCodes: parseWarningCodes(row.observation_anomaly_codes),
    estimatedCostUsd: decimalString(row.estimated_cost_usd),
    itemCostComplete: row.item_cost_complete ?? false,
    pricingGapCodes: parseWarningCodes(row.pricing_gap_codes),
    generationCovered: row.generation_covered,
  };
}

function parseWarningCodes(value: string | null): readonly string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((code): code is string => typeof code === "string");
  } catch {
    return [];
  }
}

function decimalString(value: DuckDBDecimalValue | null): string | null {
  return value === null ? null : serializeDecimal(parseFixedDecimal(String(value)));
}

function nullableBigInt(value: bigint | null): bigint | null {
  return value === null ? null : BigInt(value);
}

const HOUR_MS = 60 * 60 * 1000;
