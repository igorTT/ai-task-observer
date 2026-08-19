import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { CodexUsageObservationRepository } from "@/database/repositories/codex-usage-observation-repository.js";
import { CostCalculationService } from "@/modules/pricing/calculation-service.js";
import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import type { UsageObservation } from "@/modules/sessions/domain.js";

const logger = pino({ enabled: false });
const directories: string[] = [];
const fixture = (name: string): string =>
  fileURLToPath(new URL(`../../fixtures/pricing/${name}`, import.meta.url));

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("cost calculation generations", () => {
  test("retains immutable history and ignores running or failed generations", async () => {
    const database = await temporaryDatabase();
    const observations = new CodexUsageObservationRepository(database.connection);
    await observations.insert(observation());
    const before = await observations.stableSnapshot();
    const v1 = await loadPricingCatalog(fixture("valid-catalog.json"));
    let sequence = 0;
    const service = new CostCalculationService({
      database,
      catalog: v1,
      createId: () => `generation-${++sequence}`,
      now: monotonicClock(),
    });
    const first = await service.calculate();
    const repository = new CostCalculationRepository(database.connection);
    expect(first).toMatchObject({ status: "completed", pricingCatalogVersion: "fixture-v1" });
    const firstItems = await repository.listItems(first.generationId);
    expect(firstItems).toHaveLength(1);
    expect(firstItems[0]).toMatchObject({
      observationId: "observation-1",
      observedModel: "model-a-alias",
      canonicalModel: "model-a",
      uncachedInputRate: "2",
      cachedInputRate: "0.5",
      outputRate: "8",
      estimatedCostUsd: "0.003",
      costComplete: true,
    });

    await repository.create({
      generationId: "newer-running",
      sourceFactRevision: first.sourceFactRevision,
      catalog: v1,
      calculatorVersion: "1",
      startedAt: new Date("2026-01-02T00:00:00Z"),
    });
    expect((await repository.latestCompleted())?.generationId).toBe(first.generationId);

    const failure = new CostCalculationService({
      database,
      catalog: v1,
      createId: () => "failed-generation",
      calculateObservation: () => {
        throw new Error("private calculation detail");
      },
    });
    expect(failure.calculate()).rejects.toThrow("private calculation detail");
    expect(await repository.find("failed-generation")).toMatchObject({
      status: "failed",
      failureCategory: "calculation_failed",
    });
    expect((await repository.latestCompleted())?.generationId).toBe(first.generationId);

    const v2 = await loadPricingCatalog(fixture("valid-catalog-v2.json"));
    const recalculation = new CostCalculationService({
      database,
      catalog: v2,
      createId: () => "generation-v2",
    });
    const second = await recalculation.calculate();
    expect(second.pricingCatalogVersion).toBe("fixture-v2");
    expect((await repository.listItems(second.generationId))[0]?.estimatedCostUsd).toBe("0.03");
    expect((await repository.listItems(first.generationId))[0]?.estimatedCostUsd).toBe("0.003");
    expect((await observations.stableSnapshot()).revision).toBe(before.revision);
    database.close();
  });

  test("repeats deterministically for the same config hash and fact revision", async () => {
    const database = await temporaryDatabase();
    await new CodexUsageObservationRepository(database.connection).insert(observation());
    const catalog = await loadPricingCatalog(fixture("valid-catalog.json"));
    let sequence = 0;
    const service = new CostCalculationService({
      database,
      catalog,
      createId: () => `deterministic-${++sequence}`,
    });
    const first = await service.calculate();
    const second = await service.calculate();
    expect(second.sourceFactRevision).toBe(first.sourceFactRevision);
    expect(second.pricingContentHash).toBe(first.pricingContentHash);
    const repository = new CostCalculationRepository(database.connection);
    const firstItem = (await repository.listItems(first.generationId))[0];
    const secondItem = (await repository.listItems(second.generationId))[0];
    if (!firstItem) throw new Error("first generation item is missing");
    expect(secondItem).toEqual({ ...firstItem, generationId: second.generationId });
    database.close();
  });
});

async function temporaryDatabase(): Promise<AppDatabase> {
  const directory = await mkdtemp(join(tmpdir(), "cost-calculation-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  await applyMigrations(database, logger);
  return database;
}

function observation(): UsageObservation {
  return {
    observationId: "observation-1",
    sessionId: "session-1",
    sourcePath: "/fixture.jsonl",
    sourceIdentity: "1:1",
    sourceRecordNumber: 1n,
    parserVersion: 3,
    model: "model-a-alias",
    eventTime: new Date("2026-01-15T00:00:00Z"),
    rawCumulative: null,
    rawLast: null,
    normalized: {
      input: 1_000n,
      cachedInput: 400n,
      uncachedInput: 600n,
      output: 200n,
      total: 1_200n,
    },
    epoch: 0,
    method: "standalone_delta",
    complete: true,
    anomalyCodes: [],
    legacy: false,
  };
}

function monotonicClock(): () => Date {
  let instant = Date.parse("2026-01-01T00:00:00Z");
  return () => new Date((instant += 1_000));
}
