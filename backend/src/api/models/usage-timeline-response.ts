import type { CostGenerationIdentityResponse } from "@/api/models/issue-usage-response.js";

export type UsageTimelineRangeResponse = "12h" | "24h";
export type UsageTimelineBucketUnitResponse = "hour";
export type UsageTimelineCoverageResponse = "current" | "stale" | "missing";
export type UsageTimelineCompletenessState = "complete" | "partial" | "unavailable";

export interface UsageTimelineCompletenessResponse {
  readonly token: UsageTimelineCompletenessState;
  readonly cost: UsageTimelineCompletenessState;
}

export interface UsageTimelineTotalsResponse {
  readonly totalTokens: string | null;
  readonly estimatedCostUsd: string | null;
  readonly tokenComplete: boolean;
  readonly costComplete: boolean;
  readonly completeness: UsageTimelineCompletenessResponse;
  readonly warnings: readonly string[];
}

export interface UsageTimelineBucketResponse extends UsageTimelineTotalsResponse {
  readonly startAt: string;
  readonly endAt: string;
}

export interface UsageTimelineResponse {
  readonly range: UsageTimelineRangeResponse;
  readonly bucketUnit: UsageTimelineBucketUnitResponse;
  readonly startAt: string;
  readonly endAt: string;
  readonly totals: UsageTimelineTotalsResponse;
  readonly buckets: readonly UsageTimelineBucketResponse[];
  readonly unknownTimeObservationCount: string;
  readonly costCoverage: UsageTimelineCoverageResponse;
  readonly latestCompletedCostGeneration: CostGenerationIdentityResponse | null;
}
