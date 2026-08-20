import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapIssueUsageDailyRow,
  mapIssueUsageModelRow,
  mapIssueUsageSessionRow,
  mapIssueUsageSummaryRow,
  type IssueUsageDailyRecord,
  type IssueUsageDailyRow,
  type IssueUsageModelRecord,
  type IssueUsageModelRow,
  type IssueUsageSessionRecord,
  type IssueUsageSessionRow,
  type IssueUsageSummaryRecord,
  type IssueUsageSummaryRow,
} from "@/database/models/issue-usage.model.js";

const COMMON_CTES = `
  WITH latest_generation AS (
    SELECT generation_id
    FROM cost_calculation_generations
    WHERE status = 'completed'
    ORDER BY completed_at DESC, started_at DESC, generation_id DESC
    LIMIT 1
  ),
  linked_sessions AS (
    SELECT
      a.linear_id,
      i.identifier,
      i.title AS issue_title,
      i.url AS issue_url,
      s.session_id,
      s.current_title AS session_title,
      a.phase,
      s.import_state,
      s.last_error,
      s.started_at,
      s.ended_at
    FROM linear_session_attributions a
    JOIN codex_sessions s ON s.session_id = a.session_id
    JOIN linear_issues i ON i.linear_id = a.linear_id
    WHERE a.resolution_status = 'linked' AND a.linear_id IS NOT NULL
  ),
  usage_facts AS (
    SELECT
      ls.*,
      o.observation_id,
      o.model AS observed_model,
      o.event_time AS observation_time,
      o.normalized_input,
      o.normalized_cached_input,
      o.normalized_output,
      o.normalized_total,
      o.complete AS observation_complete,
      o.anomaly_codes AS observation_anomaly_codes,
      ci.canonical_model,
      ci.estimated_cost_usd,
      ci.cost_complete AS item_cost_complete,
      ci.gap_codes AS pricing_gap_codes,
      ci.anomaly_codes AS cost_anomaly_codes,
      ci.observation_id IS NOT NULL AS generation_covered
    FROM linked_sessions ls
    JOIN codex_usage_observations o ON o.session_id = ls.session_id
    LEFT JOIN latest_generation lg ON true
    LEFT JOIN cost_calculation_items ci
      ON ci.generation_id = lg.generation_id
      AND ci.observation_id = o.observation_id
  ),
  turn_facts AS (
    SELECT ls.*, e.event_time
    FROM linked_sessions ls
    JOIN codex_session_events e ON e.session_id = ls.session_id
    WHERE e.event_kind = 'user_message'
  )
`;

const METRIC_COLUMNS = `
  count(DISTINCT session_id)::BIGINT AS session_count,
  coalesce(sum(developer_turns), 0)::BIGINT AS developer_turns,
  CASE
    WHEN sum(CASE WHEN is_observation THEN 1 ELSE 0 END) = 0 THEN NULL
    WHEN sum(CASE WHEN is_observation AND input_tokens IS NOT NULL THEN 1 ELSE 0 END)
      <> sum(CASE WHEN is_observation THEN 1 ELSE 0 END) THEN NULL
    ELSE sum(input_tokens) FILTER (WHERE is_observation)
  END::BIGINT AS input_tokens,
  CASE
    WHEN sum(CASE WHEN is_observation THEN 1 ELSE 0 END) = 0 THEN NULL
    WHEN sum(CASE WHEN is_observation AND cached_input_tokens IS NOT NULL THEN 1 ELSE 0 END)
      <> sum(CASE WHEN is_observation THEN 1 ELSE 0 END) THEN NULL
    ELSE sum(cached_input_tokens) FILTER (WHERE is_observation)
  END::BIGINT AS cached_input_tokens,
  CASE
    WHEN sum(CASE WHEN is_observation THEN 1 ELSE 0 END) = 0 THEN NULL
    WHEN sum(CASE WHEN is_observation AND output_tokens IS NOT NULL THEN 1 ELSE 0 END)
      <> sum(CASE WHEN is_observation THEN 1 ELSE 0 END) THEN NULL
    ELSE sum(output_tokens) FILTER (WHERE is_observation)
  END::BIGINT AS output_tokens,
  CASE
    WHEN sum(CASE WHEN is_observation THEN 1 ELSE 0 END) = 0 THEN NULL
    WHEN sum(CASE WHEN is_observation AND total_tokens IS NOT NULL THEN 1 ELSE 0 END)
      <> sum(CASE WHEN is_observation THEN 1 ELSE 0 END) THEN NULL
    ELSE sum(total_tokens) FILTER (WHERE is_observation)
  END::BIGINT AS total_tokens,
  sum(estimated_cost_usd) FILTER (WHERE estimated_cost_usd IS NOT NULL)
    AS estimated_cost_usd,
  (
    sum(CASE WHEN is_observation THEN 1 ELSE 0 END) > 0
    AND sum(CASE WHEN is_observation AND observation_complete THEN 1 ELSE 0 END)
      = sum(CASE WHEN is_observation THEN 1 ELSE 0 END)
    AND sum(CASE WHEN is_observation AND input_tokens IS NOT NULL
      AND cached_input_tokens IS NOT NULL AND output_tokens IS NOT NULL
      AND total_tokens IS NOT NULL THEN 1 ELSE 0 END)
      = sum(CASE WHEN is_observation THEN 1 ELSE 0 END)
  ) AS token_complete,
  (
    sum(CASE WHEN is_observation THEN 1 ELSE 0 END) > 0
    AND sum(CASE WHEN is_observation AND generation_covered THEN 1 ELSE 0 END)
      = sum(CASE WHEN is_observation THEN 1 ELSE 0 END)
    AND sum(CASE WHEN is_observation AND item_cost_complete THEN 1 ELSE 0 END)
      = sum(CASE WHEN is_observation THEN 1 ELSE 0 END)
  ) AS cost_complete,
  string_agg(DISTINCT anomaly_codes, '\n')
    FILTER (WHERE anomaly_codes IS NOT NULL AND anomaly_codes <> '[]')
    AS anomaly_json_groups,
  string_agg(DISTINCT pricing_gap_codes, '\n')
    FILTER (WHERE pricing_gap_codes IS NOT NULL AND pricing_gap_codes <> '[]')
    AS pricing_gap_json_groups,
  sum(CASE WHEN is_observation AND NOT generation_covered THEN 1 ELSE 0 END)::BIGINT
    AS uncovered_observation_count
`;

const ISSUE_SESSION_ACTIVITIES = `
  SELECT
    ls.*,
    0::BIGINT AS developer_turns,
    false AS is_observation,
    NULL::BIGINT AS input_tokens,
    NULL::BIGINT AS cached_input_tokens,
    NULL::BIGINT AS output_tokens,
    NULL::BIGINT AS total_tokens,
    false AS observation_complete,
    NULL::DECIMAL(38, 24) AS estimated_cost_usd,
    false AS item_cost_complete,
    false AS generation_covered,
    NULL::VARCHAR AS anomaly_codes,
    NULL::VARCHAR AS pricing_gap_codes
  FROM linked_sessions ls
  UNION ALL
  SELECT
    tf.* EXCLUDE (event_time),
    1::BIGINT,
    false,
    NULL::BIGINT, NULL::BIGINT, NULL::BIGINT, NULL::BIGINT,
    false,
    NULL::DECIMAL(38, 24),
    false,
    false,
    NULL::VARCHAR,
    NULL::VARCHAR
  FROM turn_facts tf
  UNION ALL
  SELECT
    uf.* EXCLUDE (
      observation_id, observed_model, observation_time, normalized_input,
      normalized_cached_input, normalized_output, normalized_total,
      observation_complete, observation_anomaly_codes, canonical_model,
      estimated_cost_usd, item_cost_complete, pricing_gap_codes,
      cost_anomaly_codes, generation_covered
    ),
    0::BIGINT,
    true,
    normalized_input,
    normalized_cached_input,
    normalized_output,
    normalized_total,
    observation_complete,
    estimated_cost_usd,
    coalesce(item_cost_complete, false),
    generation_covered,
    CASE
      WHEN cost_anomaly_codes IS NULL OR cost_anomaly_codes = '[]'
        THEN observation_anomaly_codes
      WHEN observation_anomaly_codes = '[]' THEN cost_anomaly_codes
      ELSE observation_anomaly_codes
    END,
    pricing_gap_codes
  FROM usage_facts uf
`;

export class IssueUsageRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async countIssues(): Promise<bigint> {
    const reader = await this.connection.runAndReadAll(`
      SELECT count(DISTINCT a.linear_id)::BIGINT AS count
      FROM linear_session_attributions a
      JOIN linear_issues i ON i.linear_id = a.linear_id
      JOIN codex_sessions s ON s.session_id = a.session_id
      WHERE a.resolution_status = 'linked' AND a.linear_id IS NOT NULL
    `);
    return BigInt((reader.getRowObjects() as Array<{ count: bigint }>)[0]?.count ?? 0n);
  }

  public async listIssues(limit: number, offset: number): Promise<IssueUsageSummaryRecord[]> {
    const statement = await this.connection.prepare(`
      ${COMMON_CTES},
      activities AS (${ISSUE_SESSION_ACTIVITIES})
      SELECT linear_id, identifier, issue_title, issue_url, ${METRIC_COLUMNS}
      FROM activities
      GROUP BY linear_id, identifier, issue_title, issue_url
      ORDER BY identifier ASC, linear_id ASC
      LIMIT $limit OFFSET $offset
    `);
    statement.bind({ limit, offset });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as IssueUsageSummaryRow[]).map(
      mapIssueUsageSummaryRow,
    );
  }

  public async findIssue(linearId: string): Promise<IssueUsageSummaryRecord | undefined> {
    const statement = await this.connection.prepare(`
      ${COMMON_CTES},
      activities AS (${ISSUE_SESSION_ACTIVITIES})
      SELECT linear_id, identifier, issue_title, issue_url, ${METRIC_COLUMNS}
      FROM activities
      WHERE linear_id = $linearId
      GROUP BY linear_id, identifier, issue_title, issue_url
    `);
    statement.bind({ linearId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as IssueUsageSummaryRow[])[0];
    return row ? mapIssueUsageSummaryRow(row) : undefined;
  }

  public async listSessions(linearId: string): Promise<IssueUsageSessionRecord[]> {
    const statement = await this.connection.prepare(`
      ${COMMON_CTES},
      activities AS (${ISSUE_SESSION_ACTIVITIES})
      SELECT
        session_id, session_title, phase, import_state, last_error, started_at, ended_at,
        ${METRIC_COLUMNS}
      FROM activities
      WHERE linear_id = $linearId
      GROUP BY
        session_id, session_title, phase, import_state, last_error, started_at, ended_at
      ORDER BY started_at DESC NULLS LAST, session_id ASC
    `);
    statement.bind({ linearId });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as IssueUsageSessionRow[]).map(
      mapIssueUsageSessionRow,
    );
  }

  public async listModels(linearId: string, sessionId?: string): Promise<IssueUsageModelRecord[]> {
    const statement = await this.connection.prepare(`
      ${COMMON_CTES},
      activities AS (
        SELECT
          session_id,
          coalesce(canonical_model, 'unknown') AS model,
          observed_model,
          0::BIGINT AS developer_turns,
          true AS is_observation,
          normalized_input AS input_tokens,
          normalized_cached_input AS cached_input_tokens,
          normalized_output AS output_tokens,
          normalized_total AS total_tokens,
          observation_complete,
          estimated_cost_usd,
          coalesce(item_cost_complete, false) AS item_cost_complete,
          generation_covered,
          observation_anomaly_codes AS anomaly_codes,
          pricing_gap_codes
        FROM usage_facts
        WHERE linear_id = $linearId
          AND ($sessionId IS NULL OR session_id = $sessionId)
      )
      SELECT model, string_agg(DISTINCT observed_model, '\n') AS observed_models,
        ${METRIC_COLUMNS}
      FROM activities
      GROUP BY model
      ORDER BY CASE WHEN model = 'unknown' THEN 1 ELSE 0 END, model ASC
    `);
    statement.bind({ linearId, sessionId: sessionId ?? null });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as IssueUsageModelRow[]).map(mapIssueUsageModelRow);
  }

  public async listDaily(linearId: string): Promise<IssueUsageDailyRecord[]> {
    const statement = await this.connection.prepare(`
      ${COMMON_CTES},
      activities AS (
        SELECT
          session_id,
          cast(event_time AS DATE) AS activity_date,
          1::BIGINT AS developer_turns,
          false AS is_observation,
          NULL::BIGINT AS input_tokens,
          NULL::BIGINT AS cached_input_tokens,
          NULL::BIGINT AS output_tokens,
          NULL::BIGINT AS total_tokens,
          false AS observation_complete,
          NULL::DECIMAL(38, 24) AS estimated_cost_usd,
          false AS item_cost_complete,
          false AS generation_covered,
          NULL::VARCHAR AS anomaly_codes,
          NULL::VARCHAR AS pricing_gap_codes
        FROM turn_facts
        WHERE linear_id = $linearId
        UNION ALL
        SELECT
          session_id,
          cast(observation_time AS DATE),
          0::BIGINT,
          true,
          normalized_input,
          normalized_cached_input,
          normalized_output,
          normalized_total,
          observation_complete,
          estimated_cost_usd,
          coalesce(item_cost_complete, false),
          generation_covered,
          observation_anomaly_codes,
          pricing_gap_codes
        FROM usage_facts
        WHERE linear_id = $linearId
      )
      SELECT activity_date, ${METRIC_COLUMNS}
      FROM activities
      GROUP BY activity_date
      ORDER BY activity_date ASC NULLS LAST
    `);
    statement.bind({ linearId });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as IssueUsageDailyRow[]).map(mapIssueUsageDailyRow);
  }
}
