import type {
  AttributionStatus,
  LinearFailureCategory,
  LinearSyncRun,
} from "@/modules/linear/domain.js";

export interface LinearIssueResponse {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly team: { readonly id: string; readonly key: string; readonly name: string };
  readonly state: { readonly id: string; readonly name: string };
  readonly updatedAt: string;
  readonly synchronizedAt: string;
}

export interface SessionAttributionResponse {
  readonly status: AttributionStatus;
  readonly candidateIdentifier?: string;
  readonly phase?: string;
  readonly issue?: LinearIssueResponse;
  readonly relinkRequired: boolean;
  readonly lastAttemptAt?: string;
  readonly lastSuccessAt?: string;
  readonly synchronizationState:
    "unlinked" | "unconfigured" | "pending" | "synchronized" | "not_found" | "error";
  readonly failureCategory?: LinearFailureCategory;
}

export interface SessionRelinkResponse {
  readonly attribution: SessionAttributionResponse;
}

export interface SessionRelinkErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly failureCategory?: LinearFailureCategory;
  };
}

export interface LinearSyncRunResponse {
  readonly runId: string;
  readonly trigger: string;
  readonly state: string;
  readonly candidateCount: number;
  readonly linkedCount: number;
  readonly notFoundCount: number;
  readonly errorCount: number;
  readonly failureCategory?: LinearFailureCategory;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface LinearStatusResponse {
  readonly configured: boolean;
  readonly state: string;
  readonly acceptingWork: boolean;
  readonly counts: Record<AttributionStatus, number>;
  readonly currentRun?: LinearSyncRunResponse;
  readonly lastCompletedRun?: LinearSyncRunResponse;
}

export interface LinearSyncResponse {
  readonly runId: string;
  readonly state: "queued" | "running";
  readonly coalesced: boolean;
}

export function linearRunResponse(run: LinearSyncRun): LinearSyncRunResponse {
  return {
    runId: run.runId,
    trigger: run.trigger,
    state: run.state,
    candidateCount: run.candidateCount,
    linkedCount: run.linkedCount,
    notFoundCount: run.notFoundCount,
    errorCount: run.errorCount,
    ...(run.failureCategory ? { failureCategory: run.failureCategory } : {}),
    ...(run.startedAt ? { startedAt: run.startedAt.toISOString() } : {}),
    ...(run.completedAt ? { completedAt: run.completedAt.toISOString() } : {}),
  };
}
