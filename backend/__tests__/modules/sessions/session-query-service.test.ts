import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { SessionCostRepository } from "@/database/repositories/session-cost-repository.js";
import { SessionPhaseAssignmentRepository } from "@/database/repositories/session-phase-assignment-repository.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("SessionQueryService", () => {
  test("batches list cost reads and keeps detail cost state identical", async () => {
    fixture = await createIssueUsageFixture();
    const projection = new SessionCostRepository(fixture.database.connection);
    const requestedIds: string[][] = [];
    const service = new SessionQueryService(
      new CodexSessionRepository(fixture.database.connection),
      new CodexSessionUsageRepository(fixture.database.connection),
      new LinearSessionAttributionRepository(fixture.database.connection),
      new LinearIssueRepository(fixture.database.connection),
      {
        listBySessionIds: async (sessionIds) => {
          requestedIds.push([...sessionIds]);
          return projection.listBySessionIds(sessionIds);
        },
      },
      new SessionPhaseAssignmentRepository(fixture.database.connection),
    );

    const page = await service.list(2, 2);
    expect(requestedIds).toEqual([["session-u", "session-no-usage"]]);
    expect(page.items).toMatchObject([
      {
        sessionId: "session-u",
        estimatedCostUsd: "0.009",
        costComplete: true,
        pricingGapCodes: [],
      },
      { sessionId: "session-no-usage", estimatedCostUsd: null, pricingGapCodes: [] },
    ]);

    const detail = await service.find("session-u");
    expect(requestedIds).toEqual([["session-u", "session-no-usage"], ["session-u"]]);
    expect(detail).toEqual(page.items[0]);

    const partial = await service.find("session-a");
    expect(partial).toMatchObject({
      estimatedCostUsd: "0.15",
      costComplete: false,
      pricingGapCodes: ["cached_input_unavailable", "unknown_model", "unknown_observation_time"],
    });
    expect((await service.find("session-a"))?.attribution.phase).toBe("explore");
    expect((await service.find("session-c"))?.attribution).not.toHaveProperty("phase");
  });
});
