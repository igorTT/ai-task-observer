import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import type { Express } from "express";

import { beforeAll, describe, expect, mock, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import { createApp } from "@/app.js";
import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";
import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import type { PricingCatalog } from "@/modules/pricing/domain.js";

const logger = pino({ enabled: false });
let catalog: PricingCatalog;

beforeAll(async () => {
  catalog = await loadPricingCatalog(
    fileURLToPath(new URL("../fixtures/pricing/valid-catalog.json", import.meta.url)),
  );
});

describe("cost calculation HTTP contract", () => {
  test("reports provenance, coverage, active/queued work, and sanitized failure", async () => {
    const completed = generation("completed", "completed");
    const failed = generation("failed", "failed");
    const app = appWithCosts({
      status: () =>
        Promise.resolve({
          latestCompleted: completed,
          active: { generationId: "active", state: "running" as const },
          queued: { generationId: "queued", state: "queued" as const },
          latestFailure: failed,
          currentFactRevision: "revision-current",
          coverage: "stale" as const,
          catalog,
          calculatorVersion: "1",
          acceptingWork: true,
        }),
      recalculate: () => ({ generationId: "unused", state: "running" as const, coalesced: false }),
    });
    await withApp(app, async (server) => {
      const response = await request(server).get("/api/costs/status");
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        estimateKind: "configured_api_equivalent_usd",
        coverage: "stale",
        currentFactRevision: "revision-current",
        latestCompleted: {
          generationId: "completed",
          state: "completed",
          tokenUnit: "1000000",
        },
        active: { generationId: "active", state: "running" },
        queued: { generationId: "queued", state: "queued" },
        latestFailure: { generationId: "failed", failureCategory: "calculation_failed" },
        config: {
          schemaVersion: 1,
          catalogVersion: "fixture-v1",
          currency: "USD",
          tokenUnit: "1000000",
        },
        calculatorVersion: "1",
        acceptingWork: true,
      });
      expect(JSON.stringify(response.body)).not.toContain("private");
    });
  });

  test("accepts and returns a coalesced explicit recalculation", async () => {
    const recalculate = mock(() => ({
      generationId: "queued-generation",
      state: "queued" as const,
      coalesced: true,
    }));
    const app = appWithCosts({
      status: () => Promise.reject(new Error("unused")),
      recalculate,
    });
    await withApp(app, async (server) => {
      const response = await request(server).post("/api/costs/recalculate");
      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        generationId: "queued-generation",
        state: "queued",
        coalesced: true,
      });
    });
    expect(recalculate).toHaveBeenCalledTimes(1);
  });
});

function appWithCosts(costs: {
  status: () => Promise<{
    latestCompleted?: CostCalculationGeneration;
    active?: { generationId: string; state: "running" | "queued" };
    queued?: { generationId: string; state: "running" | "queued" };
    latestFailure?: CostCalculationGeneration;
    currentFactRevision: string;
    coverage: "current" | "stale" | "missing";
    catalog: PricingCatalog;
    calculatorVersion: string;
    acceptingWork: boolean;
  }>;
  recalculate: () => { generationId: string; state: "running" | "queued"; coalesced: boolean };
}) {
  return createApp({
    logger,
    api: {
      ingestion: {
        status: () => Promise.reject(new Error("unused")),
        rescan: () => Promise.reject(new Error("unused")),
      },
      sessions: {} as never,
      linear: {
        status: () => Promise.reject(new Error("unused")),
        sync: () => Promise.reject(new Error("unused")),
        relink: () => Promise.reject(new Error("unused")),
      },
      costs,
    },
  });
}

async function withApp<T>(app: Express, assertion: (server: Server) => Promise<T>): Promise<T> {
  const server = app.listen(30_000 + Math.floor(Math.random() * 20_000), "127.0.0.1");
  await once(server, "listening");
  try {
    return await assertion(server);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function generation(
  generationId: string,
  status: "completed" | "failed",
): CostCalculationGeneration {
  return {
    generationId,
    sourceFactRevision: "revision-1",
    status,
    pricingSchemaVersion: 1,
    pricingCatalogVersion: catalog.catalogVersion,
    pricingContentHash: catalog.contentHash,
    calculatorVersion: "1",
    tokenUnit: 1_000_000n,
    startedAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: new Date("2026-01-01T00:00:01Z"),
    failureCategory: status === "failed" ? "calculation_failed" : null,
  };
}
