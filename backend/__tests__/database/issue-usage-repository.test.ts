import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { IssueUsageRepository } from "@/database/repositories/issue-usage-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("IssueUsageRepository", () => {
  test("reconciles issue, session, model, and UTC plus unknown daily accounting", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new IssueUsageRepository(fixture.database.connection);

    expect(await repository.countIssues()).toBe(2n);
    const issues = await repository.listIssues(10, 0);
    expect(issues.map((issue) => issue.identifier)).toEqual(["ENG-1", "ENG-2"]);
    const first = issues[0]!;
    expect(first.metrics).toMatchObject({
      sessionCount: 2n,
      developerTurns: 4n,
      inputTokens: 200n,
      cachedInputTokens: null,
      outputTokens: 20n,
      totalTokens: 220n,
      estimatedCostUsd: "0.15",
      tokenComplete: false,
      costComplete: false,
      anomalyCodes: ["cached_exceeds_input"],
    });
    expect(first.metrics.pricingGapCodes).toEqual([
      "cached_input_unavailable",
      "uncovered_generation",
      "unknown_model",
      "unknown_observation_time",
    ]);

    const sessions = await repository.listSessions("issue-1");
    expect(sessions.map((session) => session.sessionId)).toEqual(["session-b", "session-a"]);
    expect(sessions[0]).toMatchObject({
      phase: "apply",
      importState: "importing",
      lastError: "retained prior snapshot",
    });
    expect(sessions[1]!.metrics).toMatchObject({
      sessionCount: 1n,
      developerTurns: 3n,
      inputTokens: 180n,
      cachedInputTokens: null,
      outputTokens: 18n,
      totalTokens: 198n,
      estimatedCostUsd: "0.15",
      costComplete: false,
    });

    const models = await repository.listModels("issue-1");
    expect(models.map((model) => model.model)).toEqual(["gpt-5.6", "unknown"]);
    expect(models[0]).toMatchObject({
      observedModels: ["gpt-alias-a", "gpt-alias-b"],
      metrics: { inputTokens: 150n, estimatedCostUsd: "0.15", costComplete: true },
    });
    expect(models[1]).toMatchObject({
      observedModels: ["gpt-alias-a", "mystery-model"],
      metrics: { inputTokens: 50n, cachedInputTokens: null, costComplete: false },
    });

    const daily = await repository.listDaily("issue-1");
    expect(daily.map((bucket) => bucket.date?.toISOString().slice(0, 10) ?? null)).toEqual([
      "2026-08-01",
      "2026-08-02",
      null,
    ]);
    expect(daily.map((bucket) => bucket.metrics.sessionCount)).toEqual([2n, 1n, 1n]);
    expect(daily.map((bucket) => bucket.metrics.developerTurns)).toEqual([3n, 1n, 0n]);
    expect(sumKnown(daily.map((bucket) => bucket.metrics.inputTokens))).toBe(200n);
    expect(sumKnown(daily.map((bucket) => bucket.metrics.outputTokens))).toBe(20n);
    expect(sumKnown(daily.map((bucket) => bucket.metrics.totalTokens))).toBe(220n);
    expect(sumDecimal(daily.map((bucket) => bucket.metrics.estimatedCostUsd))).toBeCloseTo(0.15);
  });

  test("uses committed attribution and moves full history only after a successful relink", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new IssueUsageRepository(fixture.database.connection);
    const attributions = new LinearSessionAttributionRepository(fixture.database.connection);

    await attributions.save({
      sessionId: "session-a",
      titleFingerprint: "new-title",
      candidateIdentifier: "ENG-2",
      phase: "explore",
      status: "linked",
      linearId: "issue-1",
    });
    expect((await repository.findIssue("issue-1"))?.metrics.inputTokens).toBe(200n);

    // A failed relink preserves the committed attribution row and therefore every total.
    expect((await repository.findIssue("issue-1"))?.metrics.totalTokens).toBe(220n);

    await attributions.save({
      sessionId: "session-a",
      titleFingerprint: "new-title",
      candidateIdentifier: "ENG-2",
      phase: "explore",
      status: "linked",
      linearId: "issue-2",
    });
    expect((await repository.findIssue("issue-1"))?.metrics).toMatchObject({
      sessionCount: 1n,
      inputTokens: 20n,
      totalTokens: 22n,
    });
    expect((await repository.findIssue("issue-2"))?.metrics).toMatchObject({
      sessionCount: 2n,
      inputTokens: 187n,
      totalTokens: 206n,
    });

    await attributions.save({
      sessionId: "session-b",
      titleFingerprint: "move-last-session",
      candidateIdentifier: "ENG-2",
      phase: "apply",
      status: "linked",
      linearId: "issue-2",
    });
    expect(await repository.findIssue("issue-1")).toBeUndefined();
    expect(await repository.countIssues()).toBe(1n);
  });

  test("ignores stale, running, and failed generations and marks uncovered observations", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new IssueUsageRepository(fixture.database.connection);
    const first = await repository.findIssue("issue-1");

    expect(first?.metrics.estimatedCostUsd).toBe("0.15");
    expect(first?.metrics.estimatedCostUsd).not.toBe("9.15");
    expect(first?.metrics.costComplete).toBe(false);
    expect(first?.metrics.pricingGapCodes).toContain("uncovered_generation");

    await fixture.database.connection.run(`
      DELETE FROM cost_calculation_items
      WHERE generation_id IN ('generation-current', 'generation-stale');
      UPDATE cost_calculation_generations
      SET status = 'failed', failure_category = 'calculation_failed'
      WHERE generation_id IN ('generation-current', 'generation-stale');
    `);
    const withoutCompletedGeneration = await repository.findIssue("issue-1");
    expect(withoutCompletedGeneration?.metrics.estimatedCostUsd).toBeNull();
    expect(withoutCompletedGeneration?.metrics.costComplete).toBe(false);
  });
});

function sumKnown(values: readonly (bigint | null)[]): bigint {
  return values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
}

function sumDecimal(values: readonly (string | null)[]): number {
  return values.reduce<number>((sum, value) => sum + Number(value ?? "0"), 0);
}
