import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, mock, test } from "bun:test";
import pino from "pino";

import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";
import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import {
  CostCalculationCoordinator,
  type CostCalculationOperations,
} from "@/modules/pricing/coordinator.js";
import type { PricingCatalog } from "@/modules/pricing/domain.js";

const logger = pino({ enabled: false });
let catalog: PricingCatalog;

beforeAll(async () => {
  catalog = await loadPricingCatalog(
    fileURLToPath(new URL("../../fixtures/pricing/valid-catalog.json", import.meta.url)),
  );
});

describe("cost calculation coordinator", () => {
  test("ensures initial coverage and skips duplicate startup work", async () => {
    const service = fakeService();
    const coordinator = coordinatorFor(service);
    await coordinator.start();
    expect(service.calculate).toHaveBeenCalledTimes(1);
    expect((await coordinator.status()).coverage).toBe("current");
    await coordinator.start();
    expect(service.calculate).toHaveBeenCalledTimes(1);
    await coordinator.close();
  });

  test("recalculates startup coverage after config or calculator identity changes", async () => {
    for (const completed of [
      generation("old-config", "revision-1", "old-config-hash"),
      { ...generation("old-calculator", "revision-1"), calculatorVersion: "old" },
    ]) {
      const service = fakeService({ completed });
      const coordinator = coordinatorFor(service);
      await coordinator.start();
      expect(service.calculate).toHaveBeenCalledTimes(1);
      expect((await coordinator.status()).coverage).toBe("current");
      await coordinator.close();
    }
  });

  test("debounces repeated committed-fact triggers into one generation", async () => {
    const service = fakeService({ completed: generation("covered", "revision-1") });
    const coordinator = coordinatorFor(service);
    await coordinator.start();
    service.revision = "revision-2";
    coordinator.notifyCommitted();
    coordinator.notifyCommitted();
    coordinator.notifyCommitted();
    expect((await coordinator.status()).queued?.state).toBe("queued");
    await Bun.sleep(30);
    expect(service.calculate).toHaveBeenCalledTimes(1);
    expect((await coordinator.status()).coverage).toBe("current");
    await coordinator.close();
  });

  test("coalesces explicit requests during active work and runs the queued generation", async () => {
    const firstGate = deferred<void>();
    const secondGate = deferred<void>();
    let invocation = 0;
    const service = fakeService({ completed: generation("covered", "revision-1") });
    service.calculate.mockImplementation(async (id?: string) => {
      invocation += 1;
      await (invocation === 1 ? firstGate.promise : secondGate.promise);
      const completed = generation(id ?? "missing", service.revision);
      service.completed = completed;
      return completed;
    });
    const coordinator = coordinatorFor(service);
    await coordinator.start();
    const active = coordinator.recalculate();
    const queued = coordinator.recalculate();
    const repeated = coordinator.recalculate();
    expect(active).toMatchObject({ state: "running", coalesced: false });
    expect(queued).toMatchObject({ state: "queued", coalesced: false });
    expect(repeated).toEqual({ ...queued, coalesced: true });
    firstGate.resolve();
    await waitFor(() => service.calculate.mock.calls.length === 2);
    expect((await coordinator.status()).active?.generationId).toBe(queued.generationId);
    secondGate.resolve();
    await waitFor(async () => (await coordinator.status()).active === undefined);
    expect(service.calculate).toHaveBeenCalledTimes(2);
    await coordinator.close();
  });

  test("recovers after failure and reports stale coverage for fact/config/calculator changes", async () => {
    const service = fakeService({ completed: generation("covered", "revision-1") });
    const coordinator = coordinatorFor(service);
    await coordinator.start();
    service.calculate.mockImplementationOnce((id?: string) => {
      service.failed = { ...generation(id ?? "failed", service.revision), status: "failed" };
      return Promise.reject(new Error("private failure"));
    });
    coordinator.recalculate();
    await waitFor(async () => (await coordinator.status()).active === undefined);
    expect((await coordinator.status()).latestFailure?.status).toBe("failed");
    coordinator.recalculate();
    await waitFor(async () => (await coordinator.status()).active === undefined);
    expect((await coordinator.status()).coverage).toBe("current");

    service.revision = "new-observation-revision";
    expect((await coordinator.status()).coverage).toBe("stale");
    service.completed = generation("new-observation", service.revision, "different-hash");
    expect((await coordinator.status()).coverage).toBe("stale");
    service.completed = {
      ...generation("new-observation", service.revision),
      calculatorVersion: "different-calculator",
    };
    expect((await coordinator.status()).coverage).toBe("stale");
    await coordinator.close();
  });
});

interface FakeService extends CostCalculationOperations {
  revision: string;
  completed: CostCalculationGeneration | undefined;
  failed: CostCalculationGeneration | undefined;
  calculate: ReturnType<typeof mock<CostCalculationOperations["calculate"]>>;
}

function fakeService(options: { completed?: CostCalculationGeneration } = {}): FakeService {
  const holder: { service?: FakeService } = {};
  const calculate = mock((id?: string) => {
    const service = holder.service;
    if (!service) return Promise.reject(new Error("fake service is not initialized"));
    const completed = generation(id ?? "generated", service.revision);
    service.completed = completed;
    return Promise.resolve(completed);
  });
  const service: FakeService = {
    catalog,
    calculatorVersion: "1",
    revision: "revision-1",
    completed: options.completed,
    failed: undefined,
    calculate,
    currentRevision: (): Promise<string> => Promise.resolve(service.revision),
    latestCompleted: () => Promise.resolve(service.completed),
    latestFailed: () => Promise.resolve(service.failed),
    completedForCurrentIdentity: () =>
      Promise.resolve(
        service.completed?.sourceFactRevision === service.revision &&
          service.completed.pricingContentHash === catalog.contentHash &&
          service.completed.calculatorVersion === service.calculatorVersion
          ? service.completed
          : undefined,
      ),
  } satisfies FakeService;
  holder.service = service;
  return service;
}

function coordinatorFor(service: FakeService): CostCalculationCoordinator {
  let sequence = 0;
  return new CostCalculationCoordinator({
    service,
    logger,
    debounceMs: 10,
    createId: () => `coordinator-${++sequence}`,
  });
}

function generation(
  generationId: string,
  sourceFactRevision: string,
  pricingContentHash = catalog.contentHash,
): CostCalculationGeneration {
  return {
    generationId,
    sourceFactRevision,
    status: "completed",
    pricingSchemaVersion: 1,
    pricingCatalogVersion: catalog.catalogVersion,
    pricingContentHash,
    calculatorVersion: "1",
    tokenUnit: catalog.tokenUnit,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: new Date("2026-01-01T00:00:01Z"),
    failureCategory: null,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(condition: () => boolean | Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await condition()) return;
    await Bun.sleep(2);
  }
  throw new Error("condition was not reached");
}
