import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { SessionCostRepository } from "@/database/repositories/session-cost-repository.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("SessionCostRepository", () => {
  test("projects linked and unlinked sessions with exact latest-generation semantics", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new SessionCostRepository(fixture.database.connection);

    const summaries = await repository.listBySessionIds([
      "session-a",
      "session-b",
      "session-c",
      "session-u",
      "session-no-usage",
    ]);

    expect(summaries).toEqual([
      {
        sessionId: "session-a",
        estimatedCostUsd: "0.15",
        costComplete: false,
        pricingGapCodes: ["cached_input_unavailable", "unknown_model", "unknown_observation_time"],
      },
      {
        sessionId: "session-b",
        estimatedCostUsd: null,
        costComplete: false,
        pricingGapCodes: ["uncovered_generation"],
      },
      {
        sessionId: "session-c",
        estimatedCostUsd: "0.007",
        costComplete: true,
        pricingGapCodes: [],
      },
      {
        sessionId: "session-no-usage",
        estimatedCostUsd: null,
        costComplete: false,
        pricingGapCodes: [],
      },
      {
        sessionId: "session-u",
        estimatedCostUsd: "0.009",
        costComplete: true,
        pricingGapCodes: [],
      },
    ]);
  });

  test("returns unavailable cost and uncovered-generation gap without a completed generation", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new SessionCostRepository(fixture.database.connection);

    await fixture.database.connection.run(`
      DELETE FROM cost_calculation_items;
      UPDATE cost_calculation_generations
      SET status = 'failed', failure_category = 'calculation_failed'
      WHERE status = 'completed'
    `);

    expect(await repository.listBySessionIds(["session-a", "session-no-usage"])).toEqual([
      {
        sessionId: "session-a",
        estimatedCostUsd: null,
        costComplete: false,
        pricingGapCodes: ["uncovered_generation"],
      },
      {
        sessionId: "session-no-usage",
        estimatedCostUsd: null,
        costComplete: false,
        pricingGapCodes: [],
      },
    ]);
  });

  test("uses the requested page as one projection and keeps decimal zero distinct from null", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      UPDATE cost_calculation_items
      SET estimated_cost_usd = 0
      WHERE generation_id = 'generation-current' AND observation_id = 'obs-u-1'
    `);

    const repository = new SessionCostRepository(fixture.database.connection);
    expect(await repository.listBySessionIds([])).toEqual([]);
    expect(await repository.listBySessionIds(["session-u"])).toEqual([
      {
        sessionId: "session-u",
        estimatedCostUsd: "0",
        costComplete: true,
        pricingGapCodes: [],
      },
    ]);
  });
});
