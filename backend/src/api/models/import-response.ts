export interface RootStatusResponse {
  readonly root: string;
  readonly available: boolean;
  readonly reason?: string;
  readonly discoveredFiles: number;
}

export interface ImportRunResponse {
  readonly runId: string;
  readonly trigger: string;
  readonly state: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly rootsDiscovered: number;
  readonly filesDiscovered: number;
  readonly filesImported: number;
  readonly sessionsImported: number;
  readonly warnings: number;
  readonly errors: number;
  readonly summary?: string;
}

export interface CheckpointStatusResponse {
  readonly source: string;
  readonly status: string;
  readonly completeOffset: string;
  readonly unknownRecords: number;
  readonly malformedRecords: number;
  readonly lastError?: string;
}

export interface ImportStatusResponse {
  readonly roots: readonly RootStatusResponse[];
  readonly currentRun?: ImportRunResponse;
  readonly lastCompletedRun?: ImportRunResponse;
  readonly checkpoints: readonly CheckpointStatusResponse[];
  readonly acceptingWork: boolean;
}

export interface RescanResponse {
  readonly runId: string;
  readonly state: "queued" | "running";
  readonly coalesced: boolean;
}
