import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";
import request from "supertest";

import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { startServer } from "@/server.js";

test("unknown runtime models remain incomplete without affecting backend health", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pricing-server-e2e-"));
  const root = join(directory, "sessions");
  await mkdir(root);
  await writeFile(
    join(root, "unknown-model.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-01-15T00:00:00.000Z",
        type: "session_meta",
        payload: { id: "unknown-model-session", title: "Unknown model" },
      }),
      JSON.stringify({
        timestamp: "2026-01-15T00:00:01.000Z",
        type: "turn_context",
        payload: { model: "not-in-the-catalog" },
      }),
      JSON.stringify({
        timestamp: "2026-01-15T00:00:02.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3 },
            last_token_usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3 },
          },
        },
      }),
    ].join("\n") + "\n",
  );

  const running = await startServer({
    HOST: "127.0.0.1",
    PORT: String(30_000 + Math.floor(Math.random() * 20_000)),
    DATABASE_PATH: join(directory, "test.duckdb"),
    CODEX_SESSION_ROOTS: root,
    PRICING_CATALOG_PATH: fileURLToPath(
      new URL("./fixtures/pricing/valid-catalog.json", import.meta.url),
    ),
    LOG_LEVEL: "silent",
  });
  try {
    expect((await request(running.httpServer).get("/api/health")).body).toEqual({
      status: "healthy",
    });
    const status = await request(running.httpServer).get("/api/costs/status");
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      coverage: "current",
      latestCompleted: { state: "completed" },
    });
    const repository = new CostCalculationRepository(running.database.connection);
    const latest = await repository.latestCompleted();
    if (!latest) throw new Error("startup cost generation is missing");
    const items = await repository.listItems(latest.generationId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      observedModel: "not-in-the-catalog",
      canonicalModel: null,
      estimatedCostUsd: null,
      costComplete: false,
    });
    expect(items[0]?.gapCodes).toContain("unknown_model");
  } finally {
    await running.close();
    await rm(directory, { recursive: true, force: true });
  }
});
