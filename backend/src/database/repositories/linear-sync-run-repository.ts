import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapLinearSyncRunRow,
  type LinearSyncRunRow,
} from "@/database/models/linear-sync-run.model.js";
import type {
  LinearFailureCategory,
  LinearSyncRun,
  LinearSyncRunState,
  LinearSyncTrigger,
} from "@/modules/linear/domain.js";

export class LinearSyncRunRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async create(runId: string, trigger: LinearSyncTrigger): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO linear_sync_runs (run_id, trigger, state) VALUES ($runId, $trigger, 'queued')
    `);
    statement.bind({ runId, trigger });
    await statement.run();
  }

  public async setState(
    runId: string,
    state: LinearSyncRunState,
    failureCategory?: LinearFailureCategory,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE linear_sync_runs SET
        state = $state,
        started_at = CASE WHEN $state = 'running' THEN coalesce(started_at, now()) ELSE started_at END,
        completed_at = CASE WHEN $state IN ('completed', 'failed') THEN now() ELSE completed_at END,
        failure_category = $failureCategory,
        updated_at = now()
      WHERE run_id = $runId
    `);
    statement.bind({ runId, state, failureCategory: failureCategory ?? null });
    await statement.run();
  }

  public async setCounts(
    runId: string,
    counts: Pick<LinearSyncRun, "candidateCount" | "linkedCount" | "notFoundCount" | "errorCount">,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE linear_sync_runs SET
        candidate_count = $candidateCount,
        linked_count = $linkedCount,
        not_found_count = $notFoundCount,
        error_count = $errorCount,
        updated_at = now()
      WHERE run_id = $runId
    `);
    statement.bind({ runId, ...counts });
    await statement.run();
  }

  public async addCounts(
    runId: string,
    counts: Partial<
      Pick<LinearSyncRun, "candidateCount" | "linkedCount" | "notFoundCount" | "errorCount">
    >,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE linear_sync_runs SET
        candidate_count = candidate_count + $candidateCount,
        linked_count = linked_count + $linkedCount,
        not_found_count = not_found_count + $notFoundCount,
        error_count = error_count + $errorCount,
        updated_at = now()
      WHERE run_id = $runId
    `);
    statement.bind({
      runId,
      candidateCount: counts.candidateCount ?? 0,
      linkedCount: counts.linkedCount ?? 0,
      notFoundCount: counts.notFoundCount ?? 0,
      errorCount: counts.errorCount ?? 0,
    });
    await statement.run();
  }

  public async find(runId: string): Promise<LinearSyncRun | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM linear_sync_runs WHERE run_id = $runId",
    );
    statement.bind({ runId });
    const reader = await statement.runAndReadAll();
    return mapFirst(reader.getRowObjects() as unknown as LinearSyncRunRow[]);
  }

  public async latestCompleted(): Promise<LinearSyncRun | undefined> {
    const reader = await this.connection.runAndReadAll(`
      SELECT * FROM linear_sync_runs
      WHERE state IN ('completed', 'failed')
      ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT 1
    `);
    return mapFirst(reader.getRowObjects() as unknown as LinearSyncRunRow[]);
  }
}

function mapFirst(rows: LinearSyncRunRow[]): LinearSyncRun | undefined {
  return rows[0] ? mapLinearSyncRunRow(rows[0]) : undefined;
}
