import type { DuckDBConnection } from "@duckdb/node-api";
import { createHash } from "node:crypto";

import {
  mapUsageObservationRow,
  type CodexUsageObservationRow,
} from "@/database/models/codex-usage-observation.model.js";
import type { RawTokenCounters, UsageObservation } from "@/modules/sessions/domain.js";

export class CodexUsageObservationRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async insert(observation: UsageObservation): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_usage_observations (
        observation_id, session_id, source_path, source_identity, source_record_number,
        parser_version, model, event_time,
        raw_cumulative_input, raw_cumulative_cached_input, raw_cumulative_output,
        raw_last_input, raw_last_cached_input, raw_last_output,
        normalized_input, normalized_cached_input, normalized_uncached_input,
        normalized_output, normalized_total, normalization_epoch, normalization_method,
        complete, anomaly_codes, legacy
      ) VALUES (
        $observationId, $sessionId, $sourcePath, $sourceIdentity, $recordNumber,
        $parserVersion, $model, $eventTime,
        $rawCumulativeInput, $rawCumulativeCached, $rawCumulativeOutput,
        $rawLastInput, $rawLastCached, $rawLastOutput,
        $input, $cached, $uncached, $output, $total, $epoch, $method,
        $complete, $anomalies, $legacy
      ) ON CONFLICT DO NOTHING
    `);
    statement.bind({
      observationId: observation.observationId,
      sessionId: observation.sessionId,
      sourcePath: observation.sourcePath,
      sourceIdentity: observation.sourceIdentity,
      recordNumber: observation.sourceRecordNumber,
      parserVersion: observation.parserVersion,
      model: observation.model,
      eventTime: observation.eventTime?.toISOString() ?? null,
      rawCumulativeInput: raw(observation.rawCumulative, "input"),
      rawCumulativeCached: raw(observation.rawCumulative, "cachedInput"),
      rawCumulativeOutput: raw(observation.rawCumulative, "output"),
      rawLastInput: raw(observation.rawLast, "input"),
      rawLastCached: raw(observation.rawLast, "cachedInput"),
      rawLastOutput: raw(observation.rawLast, "output"),
      input: observation.normalized.input,
      cached: observation.normalized.cachedInput,
      uncached: observation.normalized.uncachedInput,
      output: observation.normalized.output,
      total: observation.normalized.total,
      epoch: observation.epoch,
      method: observation.method,
      complete: observation.complete,
      anomalies: JSON.stringify(observation.anomalyCodes),
      legacy: observation.legacy,
    });
    await statement.run();
  }

  public async listBySessionId(sessionId: string): Promise<UsageObservation[]> {
    const statement = await this.connection.prepare(`
      SELECT * FROM codex_usage_observations WHERE session_id = $sessionId
      ORDER BY source_path, source_record_number
    `);
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as CodexUsageObservationRow[]).map(
      mapUsageObservationRow,
    );
  }

  public async stableSnapshot(): Promise<{
    readonly revision: string;
    readonly observations: readonly UsageObservation[];
  }> {
    const reader = await this.connection.runAndReadAll(`
      SELECT * FROM codex_usage_observations
      ORDER BY observation_id
    `);
    const observations = (reader.getRowObjects() as unknown as CodexUsageObservationRow[]).map(
      mapUsageObservationRow,
    );
    const hash = createHash("sha256");
    for (const observation of observations) {
      hash.update(
        JSON.stringify({
          observationId: observation.observationId,
          sessionId: observation.sessionId,
          sourcePath: observation.sourcePath,
          sourceIdentity: observation.sourceIdentity,
          sourceRecordNumber: observation.sourceRecordNumber.toString(10),
          parserVersion: observation.parserVersion,
          model: observation.model,
          eventTime: observation.eventTime?.toISOString() ?? null,
          normalized: {
            input: observation.normalized.input?.toString(10) ?? null,
            cachedInput: observation.normalized.cachedInput?.toString(10) ?? null,
            uncachedInput: observation.normalized.uncachedInput?.toString(10) ?? null,
            output: observation.normalized.output?.toString(10) ?? null,
            total: observation.normalized.total?.toString(10) ?? null,
          },
          epoch: observation.epoch,
          method: observation.method,
          complete: observation.complete,
          anomalyCodes: observation.anomalyCodes,
          legacy: observation.legacy,
        }),
      );
      hash.update("\n");
    }
    return { revision: hash.digest("hex"), observations };
  }

  public async deleteBySourcePath(sourcePath: string): Promise<void> {
    const statement = await this.connection.prepare(
      "DELETE FROM codex_usage_observations WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    await statement.run();
  }
}

function raw(counters: RawTokenCounters | null, key: keyof RawTokenCounters): bigint | null {
  return counters?.[key] ?? null;
}
