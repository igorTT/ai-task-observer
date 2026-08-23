import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapSessionCostSummaryRow,
  type SessionCostSummaryRecord,
  type SessionCostSummaryRow,
} from "@/database/models/session-cost.model.js";

export class SessionCostRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async listBySessionIds(
    sessionIds: readonly string[],
  ): Promise<SessionCostSummaryRecord[]> {
    if (sessionIds.length === 0) return [];
    const requestedValues = sessionIds.map((_, index) => `($sessionId${index})`).join(", ");
    const statement = await this.connection.prepare(`
      WITH requested_sessions(session_id) AS (
        VALUES ${requestedValues}
      ),
      latest_generation AS (
        SELECT generation_id
        FROM cost_calculation_generations
        WHERE status = 'completed'
        ORDER BY completed_at DESC, started_at DESC, generation_id DESC
        LIMIT 1
      ),
      observation_facts AS (
        SELECT
          rs.session_id,
          o.observation_id,
          ci.observation_id IS NOT NULL AS generation_covered,
          ci.estimated_cost_usd,
          ci.cost_complete AS item_cost_complete,
          ci.gap_codes AS pricing_gap_codes
        FROM requested_sessions rs
        LEFT JOIN codex_usage_observations o ON o.session_id = rs.session_id
        LEFT JOIN latest_generation lg ON true
        LEFT JOIN cost_calculation_items ci
          ON ci.generation_id = lg.generation_id
          AND ci.observation_id = o.observation_id
      )
      SELECT
        session_id,
        sum(estimated_cost_usd) FILTER (WHERE estimated_cost_usd IS NOT NULL)
          AS estimated_cost_usd,
        (
          count(observation_id) > 0
          AND sum(CASE
            WHEN observation_id IS NOT NULL AND generation_covered THEN 1 ELSE 0 END
          ) = count(observation_id)
          AND sum(CASE
            WHEN observation_id IS NOT NULL AND generation_covered AND item_cost_complete
              THEN 1 ELSE 0 END
          ) = count(observation_id)
        ) AS cost_complete,
        string_agg(DISTINCT pricing_gap_codes, '\n')
          FILTER (WHERE pricing_gap_codes IS NOT NULL AND pricing_gap_codes <> '[]')
          AS pricing_gap_json_groups,
        sum(CASE
          WHEN observation_id IS NOT NULL AND NOT generation_covered THEN 1 ELSE 0 END
        )::BIGINT AS uncovered_observation_count
      FROM observation_facts
      GROUP BY session_id
      ORDER BY session_id ASC
    `);
    statement.bind(
      Object.fromEntries(sessionIds.map((sessionId, index) => [`sessionId${index}`, sessionId])),
    );
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as SessionCostSummaryRow[]).map(
      mapSessionCostSummaryRow,
    );
  }
}
