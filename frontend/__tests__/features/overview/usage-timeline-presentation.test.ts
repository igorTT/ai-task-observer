import { describe, expect, test } from "bun:test";

import type { UsageTimelineResponse } from "@/api/generated/api";
import {
  createUsageTimelinePresentation,
  finitePlotValue,
} from "@/features/overview/usage-timeline-presentation";
import { formatUsageInterval } from "@/lib/formatters";

const timeline: UsageTimelineResponse = {
  range: "12h",
  bucketUnit: "hour",
  startAt: "2026-08-22T10:15:00.000Z",
  endAt: "2026-08-22T12:15:00.000Z",
  sessionPhase: null,
  totals: {
    totalTokens: "9007199254740993",
    estimatedCostUsd: "0.000000000000000001",
    tokenComplete: true,
    costComplete: false,
    completeness: { token: "complete", cost: "partial" },
    warnings: [],
  },
  buckets: [
    {
      startAt: "2026-08-22T10:15:00.000Z",
      endAt: "2026-08-22T11:00:00.000Z",
      totalTokens: "9007199254740993",
      estimatedCostUsd: "0.000000000000000001",
      tokenComplete: true,
      costComplete: false,
      completeness: { token: "complete", cost: "partial" },
      warnings: ["uncovered_generation"],
    },
  ],
  unknownTimeObservationCount: "0",
  costCoverage: "current",
  latestCompletedCostGeneration: null,
};

describe("usage timeline presentation boundary", () => {
  test("retains exact raw values while supplying finite chart values", () => {
    const presentation = createUsageTimelinePresentation(timeline, "UTC");
    expect(presentation.totals.totalTokens).toBe("9007199254740993");
    expect(presentation.buckets[0]).toMatchObject({
      totalTokens: "9007199254740993",
      estimatedCostUsd: "0.000000000000000001",
      tokenPlotValue: 9007199254740992,
      costPlotValue: 1e-18,
      warnings: ["uncovered_generation"],
    });
  });

  test("falls back to an unplottable point instead of fabricating zero", () => {
    expect(finitePlotValue("1e309")).toBeNull();
    expect(finitePlotValue(null)).toBeNull();
    expect(finitePlotValue("0")).toBe(0);
  });

  test("formats clipped intervals in the selected client zone", () => {
    expect(formatUsageInterval("2026-08-22T10:15:00.000Z", "2026-08-22T11:00:00.000Z", "UTC")).toBe(
      "Aug 22 at 10:15 AM – Aug 22 at 11:00 AM",
    );
  });
});
