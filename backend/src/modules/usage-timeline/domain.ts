import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";

export type UsageTimelineRange = "12h" | "24h";
export type UsageTimelineBucketUnit = "hour";
export type UsageTimelineCoverage = "current" | "stale" | "missing";
export type UsageTimelineCompleteness = "complete" | "partial" | "unavailable";

export interface UsageTimelineRangeDefinition {
  readonly range: UsageTimelineRange;
  readonly bucketUnit: UsageTimelineBucketUnit;
  readonly durationMs: number;
}

export const USAGE_TIMELINE_RANGES: Readonly<
  Record<UsageTimelineRange, UsageTimelineRangeDefinition>
> = {
  "12h": { range: "12h", bucketUnit: "hour", durationMs: 12 * 60 * 60 * 1000 },
  "24h": { range: "24h", bucketUnit: "hour", durationMs: 24 * 60 * 60 * 1000 },
};

export interface UsageTimelineWindow {
  readonly range: UsageTimelineRange;
  readonly bucketUnit: UsageTimelineBucketUnit;
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface UsageTimelineMetricRecord {
  readonly totalTokens: bigint | null;
  readonly estimatedCostUsd: string | null;
  readonly tokenComplete: boolean;
  readonly costComplete: boolean;
  readonly warnings: readonly string[];
}

export interface UsageTimelineBucketRecord extends UsageTimelineMetricRecord {
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface UsageTimelineAggregateRecord {
  readonly totals: UsageTimelineMetricRecord;
  readonly buckets: readonly UsageTimelineBucketRecord[];
  readonly unknownTimeObservationCount: bigint;
}

export interface UsageTimelineResponseRecord extends UsageTimelineAggregateRecord {
  readonly window: UsageTimelineWindow;
  readonly costCoverage: UsageTimelineCoverage;
  readonly latestCompletedCostGeneration: CostCalculationGeneration | undefined;
}

export function usageTimelineRange(value: string | undefined): UsageTimelineRange {
  if (value === undefined || value === "") return "12h";
  if (value === "12h" || value === "24h") return value;
  throw new UsageTimelineRangeError();
}

export function usageTimelineWindow(range: UsageTimelineRange, endAt: Date): UsageTimelineWindow {
  const definition = USAGE_TIMELINE_RANGES[range];
  return {
    range,
    bucketUnit: definition.bucketUnit,
    startAt: new Date(endAt.getTime() - definition.durationMs),
    endAt: new Date(endAt.getTime()),
  };
}

export class UsageTimelineRangeError extends Error {
  public readonly status = 422;
  public readonly code = "validation_error";

  public constructor() {
    super("range must be one of 12h or 24h");
    this.name = "UsageTimelineRangeError";
  }
}
