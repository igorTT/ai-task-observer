import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import { createApp } from "@/app.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import type { IngestionStatusSnapshot, RescanResult } from "@/modules/sessions/coordinator.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";
import type { SessionPageResponse, SessionResponse } from "@/api/models/session-response.js";

const logger = pino({ enabled: false });
const directories: string[] = [];
const databases: AppDatabase[] = [];

async function setup(): Promise<{
  app: ReturnType<typeof createApp>;
  repository: CodexIngestionRepository;
}> {
  const directory = await mkdtemp(join(tmpdir(), "codex-api-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  databases.push(database);
  await applyMigrations(database, logger);
  const repository = new CodexIngestionRepository(database.connection);
  const ingestion = {
    status(): Promise<IngestionStatusSnapshot> {
      return Promise.resolve({
        roots: [{ root: "/configured/missing", available: false, reason: "missing", files: [] }],
        checkpoints: [
          {
            source: "rollout-session.jsonl",
            status: "ready",
            completeOffset: "123",
            unknownRecords: 1,
            malformedRecords: 0,
          },
        ],
        acceptingWork: true,
      });
    },
    rescan(): Promise<RescanResult> {
      return Promise.resolve({ runId: "run-stable", state: "running", coalesced: true });
    },
  };
  return {
    app: createApp({
      logger,
      api: {
        ingestion,
        sessions: new SessionQueryService(repository.sessions, repository.usage),
      },
    }),
    repository,
  };
}

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("session and import HTTP contract", () => {
  test("reports unavailable roots and accepts a coalesced rescan", async () => {
    const opened = await setup();
    await withServer(opened.app, async (server) => {
      const status = await request(server).get("/api/imports/status");
      expect(status.status).toBe(200);
      expect(status.body).toMatchObject({
        roots: [{ available: false, reason: "missing", discoveredFiles: 0 }],
        checkpoints: [{ source: "rollout-session.jsonl", completeOffset: "123" }],
        acceptingWork: true,
      });
      const rescan = await request(server).post("/api/imports/rescan");
      expect(rescan.status).toBe(202);
      expect(rescan.body).toEqual({ runId: "run-stable", state: "running", coalesced: true });
    });
  });

  test("returns deterministic bounded pagination, detail, and documented not found", async () => {
    const opened = await setup();
    for (const id of ["session-b", "session-a"]) {
      await opened.repository.sessions.upsert(
        {
          sessionId: id,
          sourceRoot: "/private/root",
          sourcePath: `/private/root/${id}.jsonl`,
          title: `${id} SYNTHETIC_PUBLIC_TITLE`,
        },
        2,
      );
      await opened.repository.usage.replaceTokens(id, {
        input: 9_007_199_254_740_993n,
        cachedInput: 2n,
        output: 3n,
      });
    }
    await withServer(opened.app, async (server) => {
      const page = await request(server).get("/api/sessions?limit=1000&offset=-4");
      const pageBody = page.body as SessionPageResponse;
      expect(page.status).toBe(200);
      expect(pageBody.limit).toBe(100);
      expect(pageBody.offset).toBe(0);
      expect(pageBody.items.map((item) => item.sessionId)).toEqual(["session-a", "session-b"]);
      expect(pageBody.items[0]).toMatchObject({
        inputTokens: "9007199254740993",
        totalTokens: "9007199254740998",
        usageObserved: true,
      });
      const detail = await request(server).get("/api/sessions/session-a");
      const detailBody = detail.body as SessionResponse;
      expect(detail.status).toBe(200);
      expect(detailBody.sessionId).toBe("session-a");
      const missing = await request(server).get("/api/sessions/unknown");
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({
        error: { code: "request_error", message: "Session was not found" },
      });
      const serialized = JSON.stringify([pageBody, detailBody]);
      for (const forbidden of [
        "sourcePath",
        "sourceRoot",
        "transcript",
        "reasoning",
        "toolArguments",
        "toolResult",
        "SYNTHETIC_PRIVATE",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  });
});

async function withServer<T>(
  app: ReturnType<typeof createApp>,
  assertion: (server: Server) => Promise<T>,
): Promise<T> {
  const server = app.listen(30_000 + Math.floor(Math.random() * 20_000), "127.0.0.1");
  await once(server, "listening");
  try {
    return await assertion(server);
  } finally {
    server.close();
    await once(server, "close");
  }
}
