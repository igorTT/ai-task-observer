export type AttributionStatus =
  "unlinked" | "unconfigured" | "pending" | "linked" | "not_found" | "error";

export type LinearFailureCategory =
  | "authentication"
  | "rate_limit"
  | "network"
  | "timeout"
  | "upstream"
  | "identifier_mismatch"
  | "unknown";

export type LinearSyncTrigger = "startup" | "event" | "manual";
export type LinearSyncRunState = "queued" | "running" | "completed" | "failed";

export interface LinearIssueSummary {
  readonly linearId: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly team: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  };
  readonly state: {
    readonly id: string;
    readonly name: string;
  };
  readonly updatedAt: Date;
}

export interface CachedLinearIssue extends LinearIssueSummary {
  readonly syncedAt: Date;
}

export interface SessionAttribution {
  readonly sessionId: string;
  readonly titleFingerprint: string;
  readonly candidateIdentifier?: string;
  readonly phase?: string;
  readonly status: AttributionStatus;
  readonly linearId?: string;
  readonly lastAttemptAt?: Date;
  readonly lastSuccessAt?: Date;
  readonly failureCategory?: LinearFailureCategory;
  readonly updatedAt: Date;
}

export interface LinearSyncRun {
  readonly runId: string;
  readonly trigger: LinearSyncTrigger;
  readonly state: LinearSyncRunState;
  readonly candidateCount: number;
  readonly linkedCount: number;
  readonly notFoundCount: number;
  readonly errorCount: number;
  readonly failureCategory?: LinearFailureCategory;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type LinearLookupResult =
  | { readonly kind: "found"; readonly issue: LinearIssueSummary }
  | { readonly kind: "not_found" }
  | { readonly kind: "error"; readonly category: LinearFailureCategory };

export interface LinearIssueReader {
  readonly findIssue: (identifier: string) => Promise<LinearLookupResult>;
}
