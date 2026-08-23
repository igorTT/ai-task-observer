import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
import type {
  AttributionStatus,
  LinearFailureCategory,
  SessionAttribution,
} from "@/modules/linear/domain.js";

export interface LinearSessionAttributionRow {
  readonly session_id: string;
  readonly title_fingerprint: string;
  readonly candidate_identifier: string | null;
  readonly resolution_status: AttributionStatus;
  readonly linear_id: string | null;
  readonly last_attempt_at: DuckDBTimestampTZValue | null;
  readonly last_success_at: DuckDBTimestampTZValue | null;
  readonly failure_category: LinearFailureCategory | null;
  readonly updated_at: DuckDBTimestampTZValue;
}

export function mapLinearSessionAttributionRow(
  row: LinearSessionAttributionRow,
): SessionAttribution {
  return {
    sessionId: row.session_id,
    titleFingerprint: row.title_fingerprint,
    ...(row.candidate_identifier === null ? {} : { candidateIdentifier: row.candidate_identifier }),
    status: row.resolution_status,
    ...(row.linear_id === null ? {} : { linearId: row.linear_id }),
    ...(row.last_attempt_at === null
      ? {}
      : { lastAttemptAt: mapTimestampWithTimeZone(row.last_attempt_at) }),
    ...(row.last_success_at === null
      ? {}
      : { lastSuccessAt: mapTimestampWithTimeZone(row.last_success_at) }),
    ...(row.failure_category === null ? {} : { failureCategory: row.failure_category }),
    updatedAt: mapTimestampWithTimeZone(row.updated_at),
  };
}
