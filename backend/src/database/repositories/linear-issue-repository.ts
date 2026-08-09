import type { DuckDBConnection } from "@duckdb/node-api";

import { mapLinearIssueRow, type LinearIssueRow } from "@/database/models/linear-issue.model.js";
import type { CachedLinearIssue, LinearIssueSummary } from "@/modules/linear/domain.js";

export class LinearIssueRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async upsert(issue: LinearIssueSummary, syncedAt = new Date()): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO linear_issues (
        linear_id, identifier, title, url, team_id, team_key, team_name,
        state_id, state_name, linear_updated_at, synced_at
      ) VALUES (
        $linearId, $identifier, $title, $url, $teamId, $teamKey, $teamName,
        $stateId, $stateName, $updatedAt, $syncedAt
      )
      ON CONFLICT (linear_id) DO UPDATE SET
        identifier = excluded.identifier, title = excluded.title, url = excluded.url,
        team_id = excluded.team_id, team_key = excluded.team_key, team_name = excluded.team_name,
        state_id = excluded.state_id, state_name = excluded.state_name,
        linear_updated_at = excluded.linear_updated_at, synced_at = excluded.synced_at
    `);
    statement.bind({
      linearId: issue.linearId,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      teamId: issue.team.id,
      teamKey: issue.team.key,
      teamName: issue.team.name,
      stateId: issue.state.id,
      stateName: issue.state.name,
      updatedAt: issue.updatedAt.toISOString(),
      syncedAt: syncedAt.toISOString(),
    });
    await statement.run();
  }

  public async findByIdentifier(identifier: string): Promise<CachedLinearIssue | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM linear_issues WHERE identifier = $identifier",
    );
    statement.bind({ identifier });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as LinearIssueRow[])[0];
    return row ? mapLinearIssueRow(row) : undefined;
  }

  public async findById(linearId: string): Promise<CachedLinearIssue | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM linear_issues WHERE linear_id = $linearId",
    );
    statement.bind({ linearId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as LinearIssueRow[])[0];
    return row ? mapLinearIssueRow(row) : undefined;
  }
}
