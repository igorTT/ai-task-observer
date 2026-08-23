import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
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
  readonly started_at: DuckDBTimestampTZValue | null;
  readonly completed_at: DuckDBTimestampTZValue | null;
  readonly created_at: DuckDBTimestampTZValue;
  readonly updated_at: DuckDBTimestampTZValue;
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
    ...(row.started_at === null ? {} : { startedAt: mapTimestampWithTimeZone(row.started_at) }),
    ...(row.completed_at === null
      ? {}
      : { completedAt: mapTimestampWithTimeZone(row.completed_at) }),
    createdAt: mapTimestampWithTimeZone(row.created_at),
    updatedAt: mapTimestampWithTimeZone(row.updated_at),
  };
}
