import type { CostGenerationIdentityResponse } from "@/api/models/issue-usage-response.js";
import type {
  UsageTimelineBucketResponse,
  UsageTimelineCompletenessState,
  UsageTimelineResponse,
  UsageTimelineTotalsResponse,
} from "@/api/models/usage-timeline-response.js";
import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";
import {
  usageTimelineWindow,
  type UsageTimelineBucketRecord,
  type UsageTimelineRange,
  type UsageTimelineMetricRecord,
  type UsageTimelineSessionPhase,
} from "@/modules/usage-timeline/domain.js";
import type { UsageTimelineRepository } from "@/database/repositories/usage-timeline-repository.js";

export interface UsageTimelineCostStatusReader {
  readonly status: () => Promise<{
    readonly latestCompleted?: CostCalculationGeneration;
    readonly coverage: "current" | "stale" | "missing";
  }>;
}

export interface UsageTimelineQueryServiceOptions {
  readonly repository: UsageTimelineRepository;
  readonly costs: UsageTimelineCostStatusReader;
  readonly now?: () => Date;
}

export class UsageTimelineQueryService {
  readonly #repository: UsageTimelineRepository;
  readonly #costs: UsageTimelineCostStatusReader;
  readonly #now: () => Date;

  public constructor(options: UsageTimelineQueryServiceOptions) {
    this.#repository = options.repository;
    this.#costs = options.costs;
    this.#now = options.now ?? (() => new Date());
  }

  public async get(
    range: UsageTimelineRange = "12h",
    sessionPhase?: UsageTimelineSessionPhase,
  ): Promise<UsageTimelineResponse> {
    const endAt = this.#now();
    const [costStatus] = await Promise.all([this.#costs.status()]);
    const window = usageTimelineWindow(range, endAt);
    const aggregate = await this.#repository.query(
      window,
      costStatus.latestCompleted?.generationId,
      sessionPhase,
    );
    return {
      range: window.range,
      bucketUnit: window.bucketUnit,
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      sessionPhase: sessionPhase ?? null,
      totals: metricsResponse(aggregate.totals),
      buckets: aggregate.buckets.map(bucketResponse),
      unknownTimeObservationCount: aggregate.unknownTimeObservationCount.toString(10),
      costCoverage: costStatus.coverage,
      latestCompletedCostGeneration: costStatus.latestCompleted
        ? generationResponse(costStatus.latestCompleted)
        : null,
    };
  }
}

function metricsResponse(metrics: UsageTimelineMetricRecord): UsageTimelineTotalsResponse {
  return {
    totalTokens: metrics.totalTokens?.toString(10) ?? null,
    estimatedCostUsd: metrics.estimatedCostUsd,
    tokenComplete: metrics.tokenComplete,
    costComplete: metrics.costComplete,
    completeness: completeness(metrics),
    warnings: metrics.warnings,
  };
}

function bucketResponse(bucket: UsageTimelineBucketRecord): UsageTimelineBucketResponse {
  return {
    startAt: bucket.startAt.toISOString(),
    endAt: bucket.endAt.toISOString(),
    ...metricsResponse(bucket),
  };
}

function completeness(metrics: UsageTimelineMetricRecord): {
  readonly token: UsageTimelineCompletenessState;
  readonly cost: UsageTimelineCompletenessState;
} {
  return {
    token: state(metrics.totalTokens, metrics.tokenComplete),
    cost: state(metrics.estimatedCostUsd, metrics.costComplete),
  };
}

function state(value: bigint | string | null, complete: boolean): UsageTimelineCompletenessState {
  if (complete) return "complete";
  return value === null ? "unavailable" : "partial";
}

function generationResponse(generation: CostCalculationGeneration): CostGenerationIdentityResponse {
  return {
    generationId: generation.generationId,
    sourceFactRevision: generation.sourceFactRevision,
    pricingCatalogVersion: generation.pricingCatalogVersion,
    pricingContentHash: generation.pricingContentHash,
    calculatorVersion: generation.calculatorVersion,
    completedAt: generation.completedAt!.toISOString(),
  };
}
