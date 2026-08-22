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
      query: (queryArg) => ({
        url: `/api/sessions/${queryArg.sessionId}/relink`,
        method: "POST",
        body: queryArg.sessionRelinkRequest,
      }),
    }),
    status: build.query<StatusApiResponse, StatusApiArg>({
      query: () => ({ url: `/api/linear/status` }),
    }),
    sync: build.mutation<SyncApiResponse, SyncApiArg>({
      query: () => ({ url: `/api/linear/sync`, method: "POST" }),
    }),
    listIssueUsage: build.query<ListIssueUsageApiResponse, ListIssueUsageApiArg>({
      query: (queryArg) => ({
        url: `/api/issues/usage`,
        params: {
          limit: queryArg.limit,
          offset: queryArg.offset,
        },
      }),
    }),
    getIssueUsage: build.query<GetIssueUsageApiResponse, GetIssueUsageApiArg>({
      query: (queryArg) => ({ url: `/api/issues/${queryArg.issueId}/usage` }),
    }),
    importStatus: build.query<ImportStatusApiResponse, ImportStatusApiArg>({
      query: () => ({ url: `/api/imports/status` }),
    }),
    rescan: build.mutation<RescanApiResponse, RescanApiArg>({
      query: () => ({ url: `/api/imports/rescan`, method: "POST" }),
    }),
    costCalculationStatus: build.query<
      CostCalculationStatusApiResponse,
      CostCalculationStatusApiArg
    >({
      query: () => ({ url: `/api/costs/status` }),
    }),
    recalculateCosts: build.mutation<RecalculateCostsApiResponse, RecalculateCostsApiArg>({
      query: () => ({ url: `/api/costs/recalculate`, method: "POST" }),
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
  sessionRelinkRequest: SessionRelinkRequest;
};
export type StatusApiResponse = /** status 200 Linear integration status */ LinearStatusResponse;
export type StatusApiArg = void;
export type SyncApiResponse = /** status 202 Synchronization accepted */ LinearSyncResponse;
export type SyncApiArg = void;
export type ListIssueUsageApiResponse = /** status 200 Issue usage page */ IssueUsageListResponse;
export type ListIssueUsageApiArg = {
  limit?: number;
  offset?: number;
};
export type GetIssueUsageApiResponse =
  /** status 200 Issue usage detail */ IssueUsageDetailResponse;
export type GetIssueUsageApiArg = {
  issueId: string;
};
export type ImportStatusApiResponse = /** status 200 Status */ ImportStatusResponse;
export type ImportStatusApiArg = void;
export type RescanApiResponse = /** status 202 Accepted */ RescanResponse;
export type RescanApiArg = void;
export type CostCalculationStatusApiResponse =
  /** status 200 Status */ CostCalculationStatusResponse;
export type CostCalculationStatusApiArg = void;
export type RecalculateCostsApiResponse = /** status 202 Accepted */ RecalculateCostResponse;
export type RecalculateCostsApiArg = void;
export type HealthResponse = {
  status: "healthy";
};
export type TokenCompletenessResponse = {
  input: boolean;
  cachedInput: boolean;
  uncachedInput: boolean;
  output: boolean;
  total: boolean;
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
  inputTokens: string | null;
  cachedInputTokens: string | null;
  uncachedInputTokens: string | null;
  outputTokens: string | null;
  totalTokens: string | null;
  usageObserved: boolean;
  tokenCompleteness: TokenCompletenessResponse;
  usageAnomalies: string[];
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
export type SessionRelinkRequest = {
  /** Exact Linear issue identifier to link or relink. */
  issueIdentifier: string;
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
export type IssueUsageIdentityResponse = {
  id: string;
  identifier: string;
  title: string;
  url: string;
};
export type UsageMetricsResponse = {
  /** Distinct sessions in this grouping. Daily values are non-additive across buckets. */
  sessionCount: string;
  developerTurns: string;
  inputTokens: string | null;
  cachedInputTokens: string | null;
  outputTokens: string | null;
  totalTokens: string | null;
  estimatedCostUsd: string | null;
  tokenComplete: boolean;
  costComplete: boolean;
  anomalyCodes: string[];
  pricingGapCodes: string[];
};
export type IssueUsageSummaryResponse = {
  issue: IssueUsageIdentityResponse;
  metrics: UsageMetricsResponse;
};
export type IssueUsageListResponse = {
  items: IssueUsageSummaryResponse[];
  total: string;
  limit: number;
  offset: number;
};
export type CostGenerationIdentityResponse = {
  generationId: string;
  sourceFactRevision: string;
  pricingCatalogVersion: string;
  pricingContentHash: string;
  calculatorVersion: string;
  completedAt: string;
};
export type IssueUsageModelResponse = {
  /** Canonical model identity from the latest completed cost generation, or `unknown`. */
  model: string;
  observedModels: string[];
  metrics: UsageMetricsResponse;
};
export type IssueUsageSessionResponse = {
  sessionId: string;
  title: string | null;
  phase: string | null;
  importState: string;
  lastError: string | null;
  startedAt: string | null;
  endedAt: string | null;
  metrics: UsageMetricsResponse;
  models: IssueUsageModelResponse[];
};
export type IssueUsageDailyResponse = {
  /** UTC calendar date, or null for facts without a valid source timestamp. */
  date: string | null;
  /** Metrics are additive except sessionCount, which is distinct and non-additive across days. */
  metrics: UsageMetricsResponse;
};
export type IssueUsageDetailResponse = {
  issue: IssueUsageIdentityResponse;
  metrics: UsageMetricsResponse;
  latestCompletedCostGeneration: CostGenerationIdentityResponse | null;
  sessions: IssueUsageSessionResponse[];
  models: IssueUsageModelResponse[];
  /** Known UTC dates sort ascending; the explicit unknown-time bucket sorts last. */
  daily: IssueUsageDailyResponse[];
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
export type CostGenerationResponse = {
  generationId: string;
  sourceFactRevision: string;
  state: "running" | "completed" | "failed";
  pricingSchemaVersion: number;
  pricingCatalogVersion: string;
  pricingContentHash: string;
  calculatorVersion: string;
  tokenUnit: string;
  startedAt: string;
  completedAt?: string;
  failureCategory?: "calculation_failed";
};
export type CostWorkResponse = {
  generationId: string;
  state: "running" | "queued";
};
export type CostConfigurationResponse = {
  schemaVersion: number;
  catalogVersion: string;
  contentHash: string;
  currency: "USD";
  tokenUnit: string;
};
export type CostCalculationStatusResponse = {
  estimateKind: "configured_api_equivalent_usd";
  latestCompleted?: CostGenerationResponse;
  active?: CostWorkResponse;
  queued?: CostWorkResponse;
  latestFailure?: CostGenerationResponse;
  currentFactRevision: string;
  coverage: "current" | "stale" | "missing";
  config: CostConfigurationResponse;
  calculatorVersion: string;
  acceptingWork: boolean;
};
export type RecalculateCostResponse = {
  generationId: string;
  state: "running" | "queued";
  coalesced: boolean;
};
export const {
  useGetHealthQuery,
  useListQuery,
  useDetailQuery,
  useRelinkMutation,
  useStatusQuery,
  useSyncMutation,
  useListIssueUsageQuery,
  useGetIssueUsageQuery,
  useImportStatusQuery,
  useRescanMutation,
  useCostCalculationStatusQuery,
  useRecalculateCostsMutation,
} = injectedRtkApi;
