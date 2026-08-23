import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
import type { CachedLinearIssue } from "@/modules/linear/domain.js";

export interface LinearIssueRow {
  readonly linear_id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly team_id: string;
  readonly team_key: string;
  readonly team_name: string;
  readonly state_id: string;
  readonly state_name: string;
  readonly linear_updated_at: DuckDBTimestampTZValue;
  readonly synced_at: DuckDBTimestampTZValue;
}

export function mapLinearIssueRow(row: LinearIssueRow): CachedLinearIssue {
  return {
    linearId: row.linear_id,
    identifier: row.identifier,
    title: row.title,
    url: row.url,
    team: { id: row.team_id, key: row.team_key, name: row.team_name },
    state: { id: row.state_id, name: row.state_name },
    updatedAt: mapTimestampWithTimeZone(row.linear_updated_at),
    syncedAt: mapTimestampWithTimeZone(row.synced_at),
  };
}
