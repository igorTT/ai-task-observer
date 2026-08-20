/** Shared accounting metrics. Integer and fixed-decimal values are strings for JSON safety. */
export interface UsageMetricsResponse {
  /** Distinct sessions in this grouping. Daily values are non-additive across buckets. */
  readonly sessionCount: string;
  readonly developerTurns: string;
  readonly inputTokens: string | null;
  readonly cachedInputTokens: string | null;
  readonly outputTokens: string | null;
  readonly totalTokens: string | null;
  readonly estimatedCostUsd: string | null;
  readonly tokenComplete: boolean;
  readonly costComplete: boolean;
  readonly anomalyCodes: readonly string[];
  readonly pricingGapCodes: readonly string[];
}

export interface IssueUsageIdentityResponse {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
}

export interface IssueUsageSummaryResponse {
  readonly issue: IssueUsageIdentityResponse;
  readonly metrics: UsageMetricsResponse;
}

export interface IssueUsageListResponse {
  readonly items: readonly IssueUsageSummaryResponse[];
  readonly total: string;
  readonly limit: number;
  readonly offset: number;
}

export interface IssueUsageModelResponse {
  /** Canonical model identity from the latest completed cost generation, or `unknown`. */
  readonly model: string;
  readonly observedModels: readonly string[];
  readonly metrics: UsageMetricsResponse;
}

export interface IssueUsageSessionResponse {
  readonly sessionId: string;
  readonly title: string | null;
  readonly phase: string | null;
  readonly importState: string;
  readonly lastError: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly metrics: UsageMetricsResponse;
  readonly models: readonly IssueUsageModelResponse[];
}

export interface IssueUsageDailyResponse {
  /** UTC calendar date, or null for facts without a valid source timestamp. */
  readonly date: string | null;
  /** Metrics are additive except sessionCount, which is distinct and non-additive across days. */
  readonly metrics: UsageMetricsResponse;
}

export interface CostGenerationIdentityResponse {
  readonly generationId: string;
  readonly sourceFactRevision: string;
  readonly pricingCatalogVersion: string;
  readonly pricingContentHash: string;
  readonly calculatorVersion: string;
  readonly completedAt: string;
}

export interface IssueUsageDetailResponse extends IssueUsageSummaryResponse {
  readonly latestCompletedCostGeneration: CostGenerationIdentityResponse | null;
  readonly sessions: readonly IssueUsageSessionResponse[];
  readonly models: readonly IssueUsageModelResponse[];
  /** Known UTC dates sort ascending; the explicit unknown-time bucket sorts last. */
  readonly daily: readonly IssueUsageDailyResponse[];
}
