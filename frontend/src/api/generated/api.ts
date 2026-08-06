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
export type ImportStatusApiResponse = /** status 200 Status */ ImportStatusResponse;
export type ImportStatusApiArg = void;
export type RescanApiResponse = /** status 202 Accepted */ RescanResponse;
export type RescanApiArg = void;
export type HealthResponse = {
  status: "healthy";
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
  useImportStatusQuery,
  useRescanMutation,
} = injectedRtkApi;
