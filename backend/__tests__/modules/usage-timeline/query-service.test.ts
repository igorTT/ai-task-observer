import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { UsageTimelineRepository } from "@/database/repositories/usage-timeline-repository.js";
import { UsageTimelineQueryService } from "@/modules/usage-timeline/query-service.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("UsageTimelineQueryService", () => {
  test("uses one cutoff and exposes generation provenance for the default range", async () => {
    fixture = await createIssueUsageFixture();
    const service = new UsageTimelineQueryService({
      repository: new UsageTimelineRepository(fixture.database.connection),
      costs: costStatus("generation-current", "current"),
      now: () => new Date("2026-08-01T14:00:00.000Z"),
    });

    const result = await service.get();

    expect(result).toMatchObject({
      range: "12h",
      bucketUnit: "hour",
      startAt: "2026-08-01T02:00:00.000Z",
      endAt: "2026-08-01T14:00:00.000Z",
      unknownTimeObservationCount: "1",
      costCoverage: "current",
      latestCompletedCostGeneration: { generationId: "generation-current" },
    });
    expect(result.totals).toMatchObject({
      totalTokens: "1230",
      estimatedCostUsd: "0.109",
      tokenComplete: true,
      costComplete: false,
      completeness: { token: "complete", cost: "partial" },
    });
  });

  test("supports an explicit 24-hour range without frontend aggregation", async () => {
    fixture = await createIssueUsageFixture();
    const service = new UsageTimelineQueryService({
      repository: new UsageTimelineRepository(fixture.database.connection),
      costs: costStatus("generation-current", "stale"),
      now: () => new Date("2026-08-02T14:00:00.000Z"),
    });

    const result = await service.get("24h");

    expect(result.range).toBe("24h");
    expect(result.startAt).toBe("2026-08-01T14:00:00.000Z");
    expect(result.totals).toMatchObject({
      totalTokens: "63",
      estimatedCostUsd: "0.057",
      tokenComplete: true,
      costComplete: true,
    });
    expect(result.costCoverage).toBe("stale");
  });

  test("returns token facts and sanitized warnings when pricing is unavailable", async () => {
    fixture = await createIssueUsageFixture();
    const service = new UsageTimelineQueryService({
      repository: new UsageTimelineRepository(fixture.database.connection),
      costs: costStatus(undefined, "missing"),
      now: () => new Date("2026-08-02T14:00:00.000Z"),
    });

    const result = await service.get("24h");
    const serialized = JSON.stringify(result);
    expect(result.totals).toMatchObject({ totalTokens: "63", estimatedCostUsd: null });
    expect(result.costCoverage).toBe("missing");
    expect(serialized).not.toContain("/root/");
    expect(serialized).not.toContain("selected");
  });
});

function costStatus(generationId: string | undefined, coverage: "current" | "stale" | "missing") {
  return {
    status: () =>
      Promise.resolve({
        ...(generationId
          ? {
              latestCompleted: {
                generationId,
                sourceFactRevision: "revision",
                status: "completed" as const,
                pricingSchemaVersion: 1,
                pricingCatalogVersion: "catalog",
                pricingContentHash: "hash",
                calculatorVersion: "1",
                tokenUnit: 1_000_000n,
                startedAt: new Date("2026-08-01T00:00:00.000Z"),
                completedAt: new Date("2026-08-01T00:00:01.000Z"),
                failureCategory: null,
              },
            }
          : {}),
        coverage,
      }),
  };
}
