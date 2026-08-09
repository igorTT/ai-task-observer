import type {
  LinearFailureCategory,
  LinearSyncRun,
  LinearSyncRunState,
  LinearSyncTrigger,
} from "@/modules/linear/domain.js";

export interface LinearSyncRunRow {
  readonly run_id: string;
  readonly trigger: LinearSyncTrigger;
  readonly state: LinearSyncRunState;
  readonly candidate_count: number;
  readonly linked_count: number;
  readonly not_found_count: number;
  readonly error_count: number;
  readonly failure_category: LinearFailureCategory | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export function mapLinearSyncRunRow(row: LinearSyncRunRow): LinearSyncRun {
  return {
    runId: row.run_id,
    trigger: row.trigger,
    state: row.state,
    candidateCount: Number(row.candidate_count),
    linkedCount: Number(row.linked_count),
    notFoundCount: Number(row.not_found_count),
    errorCount: Number(row.error_count),
    ...(row.failure_category === null ? {} : { failureCategory: row.failure_category }),
    ...(row.started_at === null ? {} : { startedAt: new Date(row.started_at) }),
    ...(row.completed_at === null ? {} : { completedAt: new Date(row.completed_at) }),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
