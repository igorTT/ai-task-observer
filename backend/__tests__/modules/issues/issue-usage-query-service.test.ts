import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { IssueUsageRepository } from "@/database/repositories/issue-usage-repository.js";
import { IssueUsageQueryService } from "@/modules/issues/issue-usage-query-service.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("IssueUsageQueryService", () => {
  test("assembles JSON-safe list and complete nested detail from repository facts", async () => {
    fixture = await createIssueUsageFixture();
    const service = new IssueUsageQueryService(
      new IssueUsageRepository(fixture.database.connection),
      new CostCalculationRepository(fixture.database.connection),
    );

    const page = await service.list(1, 0);
    expect(page).toMatchObject({
      total: "2",
      limit: 1,
      offset: 0,
      items: [
        {
          issue: { id: "issue-1", identifier: "ENG-1" },
          metrics: {
            sessionCount: "2",
            inputTokens: "200",
            cachedInputTokens: null,
            estimatedCostUsd: "0.15",
          },
        },
      ],
    });

    const detail = await service.find("issue-1");
    expect(detail).toMatchObject({
      issue: { identifier: "ENG-1" },
      latestCompletedCostGeneration: {
        generationId: "generation-current",
        sourceFactRevision: "current-revision",
      },
    });
    expect(detail?.sessions).toHaveLength(2);
    expect(detail?.sessions[0]).toMatchObject({
      sessionId: "session-b",
      phase: "apply",
      importState: "importing",
      models: [{ model: "unknown" }],
    });
    expect(detail?.models.map((model) => model.model)).toEqual(["gpt-5.6", "unknown"]);
    expect(detail?.daily.map((bucket) => bucket.date)).toEqual(["2026-08-01", "2026-08-02", null]);
    expect(await service.find("issue-empty")).toBeUndefined();
  });
});
