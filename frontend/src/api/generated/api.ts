import { baseApi as api } from "../base-api";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/api/health` }),
    }),
    list: build.query<ListApiResponse, ListApiArg>({
      query: (queryArg) => ({
        url: `/api/sessions`,
        params: {
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    detail: build.query<DetailApiResponse, DetailApiArg>({
      query: (queryArg) => ({ url: `/api/sessions/${queryArg.sessionId}` }),
    }),
    relink: build.mutation<RelinkApiResponse, RelinkApiArg>({
      query: (queryArg) => ({ url: `/api/sessions/${queryArg.sessionId}/relink`, method: "POST" }),
    }),
    status: build.query<StatusApiResponse, StatusApiArg>({
      query: () => ({ url: `/api/linear/status` }),
    }),
    sync: build.mutation<SyncApiResponse, SyncApiArg>({
      query: () => ({ url: `/api/linear/sync`, method: "POST" }),
    }),
    importStatus: build.query<ImportStatusApiResponse, ImportStatusApiArg>({
      query: () => ({ url: `/api/imports/status` }),
    }),
    rescan: build.mutation<RescanApiResponse, RescanApiArg>({
      query: () => ({ url: `/api/imports/rescan`, method: "POST" }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedApi };
export type GetHealthApiResponse = /** status 200 Healthy */ HealthResponse;
export type GetHealthApiArg = void;
export type ListApiResponse = /** status 200 Session page */ SessionPageResponse;
export type ListApiArg = {
  limit?: number;
  offset?: number;
};
export type DetailApiResponse = /** status 200 Session detail */ SessionResponse;
export type DetailApiArg = {
  sessionId: string;
};
export type RelinkApiResponse =
  /** status 200 Session attribution relinked */ SessionRelinkResponse;
export type RelinkApiArg = {
  sessionId: string;
};
export type StatusApiResponse = /** status 200 Linear integration status */ LinearStatusResponse;
export type StatusApiArg = void;
export type SyncApiResponse = /** status 202 Synchronization accepted */ LinearSyncResponse;
export type SyncApiArg = void;
export type ImportStatusApiResponse = /** status 200 Status */ ImportStatusResponse;
export type ImportStatusApiArg = void;
export type RescanApiResponse = /** status 202 Accepted */ RescanResponse;
export type RescanApiArg = void;
export type HealthResponse = {
  status: "healthy";
};
export type AttributionStatus =
  "unlinked" | "unconfigured" | "pending" | "linked" | "not_found" | "error";
export type LinearIssueResponse = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  team: {
    name: string;
    key: string;
    id: string;
  };
  state: {
    name: string;
    id: string;
  };
  updatedAt: string;
  synchronizedAt: string;
};
export type LinearFailureCategory =
  | "authentication"
  | "rate_limit"
  | "network"
  | "timeout"
  | "upstream"
  | "identifier_mismatch"
  | "unknown";
export type SessionAttributionResponse = {
  status: AttributionStatus;
  candidateIdentifier?: string;
  phase?: string;
  issue?: LinearIssueResponse;
  relinkRequired: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  synchronizationState:
    "unlinked" | "unconfigured" | "pending" | "synchronized" | "not_found" | "error";
  failureCategory?: LinearFailureCategory;
};
export type SessionResponse = {
  sessionId: string;
  currentTitle?: string;
  startedAt?: string;
  endedAt?: string;
  developerTurns: string;
  inputTokens: string;
  cachedInputTokens: string;
  outputTokens: string;
  totalTokens: string;
  usageObserved: boolean;
  importState: string;
  attribution: SessionAttributionResponse;
};
export type SessionPageResponse = {
  items: SessionResponse[];
  total: number;
  limit: number;
  offset: number;
};
export type ErrorResponse = {
  error: {
    message: string;
    code: string;
  };
};
export type SessionRelinkResponse = {
  attribution: SessionAttributionResponse;
};
export type SessionRelinkErrorResponse = {
  error: {
    failureCategory?: LinearFailureCategory;
    message: string;
    code: string;
  };
};
export type RecordAttributionStatusNumber = {
  unlinked: number;
  unconfigured: number;
  pending: number;
  linked: number;
  not_found: number;
  error: number;
};
export type LinearSyncRunResponse = {
  runId: string;
  trigger: string;
  state: string;
  candidateCount: number;
  linkedCount: number;
  notFoundCount: number;
  errorCount: number;
  failureCategory?: LinearFailureCategory;
  startedAt?: string;
  completedAt?: string;
};
export type LinearStatusResponse = {
  configured: boolean;
  state: string;
  acceptingWork: boolean;
  counts: RecordAttributionStatusNumber;
  currentRun?: LinearSyncRunResponse;
  lastCompletedRun?: LinearSyncRunResponse;
};
export type LinearSyncResponse = {
  runId: string;
  state: "queued" | "running";
  coalesced: boolean;
};
export type RootStatusResponse = {
  root: string;
  available: boolean;
  reason?: string;
  discoveredFiles: number;
};
export type ImportRunResponse = {
  runId: string;
  trigger: string;
  state: string;
  startedAt?: string;
  completedAt?: string;
  rootsDiscovered: number;
  filesDiscovered: number;
  filesImported: number;
  sessionsImported: number;
  warnings: number;
  errors: number;
  summary?: string;
};
export type CheckpointStatusResponse = {
  source: string;
  status: string;
  completeOffset: string;
  unknownRecords: number;
  malformedRecords: number;
  lastError?: string;
};
export type ImportStatusResponse = {
  roots: RootStatusResponse[];
  currentRun?: ImportRunResponse;
  lastCompletedRun?: ImportRunResponse;
  checkpoints: CheckpointStatusResponse[];
  acceptingWork: boolean;
};
export type RescanResponse = {
  runId: string;
  state: "queued" | "running";
  coalesced: boolean;
};
export const {
  useGetHealthQuery,
  useListQuery,
  useDetailQuery,
  useRelinkMutation,
  useStatusQuery,
  useSyncMutation,
  useImportStatusQuery,
  useRescanMutation,
} = injectedRtkApi;
