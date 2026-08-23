import type { UsageTimelineBucketResponse, UsageTimelineResponse } from "@/api/generated/api";
import { formatUsageInterval } from "@/lib/formatters";

export interface UsageTimelinePresentationBucket {
  readonly index: number;
  readonly startAt: string;
  readonly endAt: string;
  readonly intervalLabel: string;
  readonly shortLabel: string;
  readonly totalTokens: string | null;
  readonly estimatedCostUsd: string | null;
  readonly tokenPlotValue: number | null;
  readonly costPlotValue: number | null;
  readonly tokenComplete: boolean;
  readonly costComplete: boolean;
  readonly completeness: UsageTimelineBucketResponse["completeness"];
  readonly warnings: readonly string[];
}

export interface UsageTimelinePresentation {
  readonly totals: UsageTimelineResponse["totals"];
  readonly buckets: readonly UsageTimelinePresentationBucket[];
}

export function createUsageTimelinePresentation(
  timeline: UsageTimelineResponse,
  timeZone?: string,
): UsageTimelinePresentation {
  return {
    totals: timeline.totals,
    buckets: timeline.buckets.map((bucket, index) => bucketPresentation(bucket, index, timeZone)),
  };
}

export function finitePlotValue(value: string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function bucketPresentation(
  bucket: UsageTimelineBucketResponse,
  index: number,
  timeZone?: string,
): UsageTimelinePresentationBucket {
  return {
    index,
    startAt: bucket.startAt,
    endAt: bucket.endAt,
    intervalLabel: formatUsageInterval(bucket.startAt, bucket.endAt, timeZone),
    shortLabel: formatUsageInterval(bucket.startAt, bucket.endAt, timeZone),
    totalTokens: bucket.totalTokens,
    estimatedCostUsd: bucket.estimatedCostUsd,
    tokenPlotValue: finitePlotValue(bucket.totalTokens),
    costPlotValue: finitePlotValue(bucket.estimatedCostUsd),
    tokenComplete: bucket.tokenComplete,
    costComplete: bucket.costComplete,
    completeness: bucket.completeness,
    warnings: bucket.warnings,
  };
}
