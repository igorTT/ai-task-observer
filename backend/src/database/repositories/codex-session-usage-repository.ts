import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapUsageRow,
  type CodexSessionUsageRecord,
  type CodexSessionUsageRow,
} from "@/database/models/codex-session-usage.model.js";
import {
  assertNonNegative,
  type TokenValues,
  type UsageObservation,
} from "@/modules/sessions/domain.js";

export class CodexSessionUsageRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async ensure(sessionId: string): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_session_usage (session_id) VALUES ($sessionId)
      ON CONFLICT (session_id) DO NOTHING
    `);
    statement.bind({ sessionId });
    await statement.run();
  }

  public async replaceTokens(sessionId: string, values: TokenValues): Promise<void> {
    assertNonNegative(values.input, "input tokens");
    assertNonNegative(values.cachedInput, "cached input tokens");
    assertNonNegative(values.output, "output tokens");
    if (values.cachedInput > values.input) throw new RangeError("cached input exceeds input");
    await this.ensure(sessionId);
    const statement = await this.connection.prepare(`
      UPDATE codex_session_usage SET
        input_tokens = $input,
        cached_input_tokens = $cached,
        uncached_input_tokens = $input - $cached,
        output_tokens = $output,
        total_tokens = $input + $output,
        usage_observed = true,
        input_complete = true,
        cached_input_complete = true,
        uncached_input_complete = true,
        output_complete = true,
        total_complete = true,
        anomaly_codes = '[]',
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({
      sessionId,
      input: values.input,
      cached: values.cachedInput,
      output: values.output,
    });
    await statement.run();
  }

  public async recompute(
    sessionId: string,
    observations: readonly UsageObservation[],
    developerTurns: bigint,
    factRevision: bigint,
  ): Promise<void> {
    await this.ensure(sessionId);
    const input = sumKnown(observations, "input");
    const cached = sumKnown(observations, "cachedInput");
    const uncached = sumKnown(observations, "uncachedInput");
    const output = sumKnown(observations, "output");
    const total = sumKnown(observations, "total");
    const anomalies = [...new Set(observations.flatMap((observation) => observation.anomalyCodes))];
    const updateSession = await this.connection.prepare(`
      UPDATE codex_sessions SET
        developer_turns = $developerTurns,
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    updateSession.bind({ sessionId, developerTurns });
    await updateSession.run();
    const statement = await this.connection.prepare(`
      UPDATE codex_session_usage SET
        input_tokens = $input,
        cached_input_tokens = $cached,
        uncached_input_tokens = $uncached,
        output_tokens = $output,
        total_tokens = $total,
        usage_observed = $usageObserved,
        input_complete = $inputComplete,
        cached_input_complete = $cachedComplete,
        uncached_input_complete = $uncachedComplete,
        output_complete = $outputComplete,
        total_complete = $totalComplete,
        anomaly_codes = $anomalies,
        fact_revision = $factRevision,
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({
      sessionId,
      input,
      cached,
      uncached,
      output,
      total,
      usageObserved: observations.length > 0,
      inputComplete: categoryComplete(observations, "input"),
      cachedComplete: categoryComplete(observations, "cachedInput"),
      uncachedComplete: categoryComplete(observations, "uncachedInput"),
      outputComplete: categoryComplete(observations, "output"),
      totalComplete: categoryComplete(observations, "total"),
      anomalies: JSON.stringify(anomalies),
      factRevision,
    });
    await statement.run();
  }

  public async findBySessionId(sessionId: string): Promise<CodexSessionUsageRecord | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_session_usage WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexSessionUsageRow[])[0];
    return row ? mapUsageRow(row) : undefined;
  }
}

function categoryComplete(
  observations: readonly UsageObservation[],
  category: keyof UsageObservation["normalized"],
): boolean {
  return (
    observations.length > 0 &&
    observations.every(
      (observation) => !observation.legacy && observation.normalized[category] !== null,
    )
  );
}

function sumKnown(
  observations: readonly UsageObservation[],
  category: keyof UsageObservation["normalized"],
): bigint | null {
  if (observations.length === 0) return null;
  let total = 0n;
  for (const observation of observations) {
    const value = observation.normalized[category];
    if (value === null) return null;
    total += value;
  }
  return total;
}
