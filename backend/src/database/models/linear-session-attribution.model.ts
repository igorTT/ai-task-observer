import type {
  AttributionStatus,
  LinearFailureCategory,
  SessionAttribution,
} from "@/modules/linear/domain.js";

export interface LinearSessionAttributionRow {
  readonly session_id: string;
  readonly title_fingerprint: string;
  readonly candidate_identifier: string | null;
  readonly phase: string | null;
  readonly resolution_status: AttributionStatus;
  readonly linear_id: string | null;
  readonly last_attempt_at: Date | null;
  readonly last_success_at: Date | null;
  readonly failure_category: LinearFailureCategory | null;
  readonly updated_at: Date;
}

export function mapLinearSessionAttributionRow(
  row: LinearSessionAttributionRow,
): SessionAttribution {
  return {
    sessionId: row.session_id,
    titleFingerprint: row.title_fingerprint,
    ...(row.candidate_identifier === null ? {} : { candidateIdentifier: row.candidate_identifier }),
    ...(row.phase === null ? {} : { phase: row.phase }),
    status: row.resolution_status,
    ...(row.linear_id === null ? {} : { linearId: row.linear_id }),
    ...(row.last_attempt_at === null ? {} : { lastAttemptAt: new Date(row.last_attempt_at) }),
    ...(row.last_success_at === null ? {} : { lastSuccessAt: new Date(row.last_success_at) }),
    ...(row.failure_category === null ? {} : { failureCategory: row.failure_category }),
    updatedAt: new Date(row.updated_at),
  };
}
