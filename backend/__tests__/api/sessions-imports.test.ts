import { mkdtemp, rm } from "node:fs/promises";
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
import type { UsageObservation } from "@/modules/sessions/domain.js";

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
  const repository = new CodexIngestionRepository(database);
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
        linear: {
          status: () =>
            Promise.resolve({
              configured: false,
              state: "unconfigured" as const,
              acceptingWork: true,
              counts: {
                unlinked: 0,
                unconfigured: 0,
                pending: 0,
                linked: 0,
                not_found: 0,
                error: 0,
              },
            }),
          sync: () => Promise.reject(new Error("Linear integration is not configured")),
          relink: () => Promise.reject(new Error("Linear integration is not configured")),
        },
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
    await withApp(opened.app, async (app) => {
      const status = await request(app).get("/api/imports/status");
      expect(status.status).toBe(200);
      expect(status.body).toMatchObject({
        roots: [{ available: false, reason: "missing", discoveredFiles: 0 }],
        checkpoints: [{ source: "rollout-session.jsonl", completeOffset: "123" }],
        acceptingWork: true,
      });
      const rescan = await request(app).post("/api/imports/rescan");
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
    await withApp(opened.app, async (app) => {
      const page = await request(app).get("/api/sessions?limit=1000&offset=-4");
      const pageBody = page.body as SessionPageResponse;
      expect(page.status).toBe(200);
      expect(pageBody.limit).toBe(100);
      expect(pageBody.offset).toBe(0);
      expect(pageBody.items.map((item) => item.sessionId)).toEqual(["session-a", "session-b"]);
      expect(pageBody.items[0]).toMatchObject({
        inputTokens: "9007199254740993",
        totalTokens: "9007199254740996",
        uncachedInputTokens: "9007199254740991",
        usageObserved: true,
        tokenCompleteness: {
          input: true,
          cachedInput: true,
          uncachedInput: true,
          output: true,
          total: true,
        },
        usageAnomalies: [],
      });
      const detail = await request(app).get("/api/sessions/session-a");
      const detailBody = detail.body as SessionResponse;
      expect(detail.status).toBe(200);
      expect(detailBody.sessionId).toBe("session-a");
      const missing = await request(app).get("/api/sessions/unknown");
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

  test("returns absent, incomplete, anomalous, and rebuilt usage without message transcripts", async () => {
    const opened = await setup();
    for (const id of ["absent", "incomplete", "rebuilt"]) {
      await opened.repository.sessions.upsert(
        {
          sessionId: id,
          sourceRoot: "/private/root",
          sourcePath: `/private/root/${id}.jsonl`,
        },
        3,
      );
      await opened.repository.usage.ensure(id);
    }
    await opened.repository.usage.recompute(
      "incomplete",
      [
        observation("incomplete", {
          input: 3n,
          cachedInput: null,
          uncachedInput: null,
          output: 1n,
          total: 4n,
        }),
      ],
      1n,
      1n,
    );
    await opened.repository.usage.recompute(
      "rebuilt",
      [
        observation("rebuilt", {
          input: 1n,
          cachedInput: 0n,
          uncachedInput: 1n,
          output: 1n,
          total: 2n,
        }),
      ],
      1n,
      1n,
    );
    await opened.repository.usage.recompute(
      "rebuilt",
      [
        observation("rebuilt", {
          input: 5n,
          cachedInput: 2n,
          uncachedInput: 3n,
          output: 3n,
          total: 8n,
        }),
      ],
      1n,
      2n,
    );
    await opened.repository.events.insert({
      eventId: "private-message",
      sessionId: "rebuilt",
      sourcePath: "/private/root/rebuilt.jsonl",
      sourceIdentity: "private",
      sourceRecordNumber: 1n,
      kind: "user_message",
      messageRole: "user",
      eventTime: null,
      messageContent: "PRIVATE_SELECTED_MESSAGE",
      parserVersion: 3,
    });

    await withApp(opened.app, async (app) => {
      const absent = await request(app).get("/api/sessions/absent");
      expect(absent.body).toMatchObject({
        inputTokens: null,
        cachedInputTokens: null,
        uncachedInputTokens: null,
        outputTokens: null,
        totalTokens: null,
        usageObserved: false,
        tokenCompleteness: {
          input: false,
          cachedInput: false,
          uncachedInput: false,
          output: false,
          total: false,
        },
        usageAnomalies: [],
      });
      const incomplete = await request(app).get("/api/sessions/incomplete");
      expect(incomplete.body).toMatchObject({
        inputTokens: "3",
        cachedInputTokens: null,
        uncachedInputTokens: null,
        outputTokens: "1",
        totalTokens: "4",
        usageObserved: true,
        tokenCompleteness: {
          input: true,
          cachedInput: false,
          uncachedInput: false,
          output: true,
          total: true,
        },
        usageAnomalies: ["cached_exceeds_input"],
      });
      const rebuilt = await request(app).get("/api/sessions/rebuilt");
      expect(rebuilt.body).toMatchObject({
        inputTokens: "5",
        cachedInputTokens: "2",
        uncachedInputTokens: "3",
        outputTokens: "3",
        totalTokens: "8",
        usageObserved: true,
      });
      expect(JSON.stringify([absent.body, incomplete.body, rebuilt.body])).not.toContain(
        "PRIVATE_SELECTED_MESSAGE",
      );
    });
  });

  test("exposes reconciled index titles through list and detail without source metadata", async () => {
    const opened = await setup();
    await opened.repository.sessions.upsert(
      {
        sessionId: "indexed-session",
        sourceRoot: "/private/root",
        sourcePath: "/private/root/indexed-session.jsonl",
        title: "old title",
      },
      3,
    );
    await opened.repository.usage.ensure("indexed-session");
    await opened.repository.reconcileSessionIndexTitles(
      new Map([["indexed-session", "ENG-404: indexed rename"]]),
    );

    await withApp(opened.app, async (app) => {
      const list = await request(app).get("/api/sessions?limit=100&offset=0");
      const detail = await request(app).get("/api/sessions/indexed-session");
      const listBody = list.body as SessionPageResponse;
      const detailBody = detail.body as SessionResponse;
      expect(list.status).toBe(200);
      expect(
        listBody.items.some(
          (item) =>
            item.sessionId === "indexed-session" && item.currentTitle === "ENG-404: indexed rename",
        ),
      ).toBe(true);
      expect(detail.status).toBe(200);
      expect(detailBody).toMatchObject({
        sessionId: "indexed-session",
        currentTitle: "ENG-404: indexed rename",
      });
      expect(JSON.stringify([listBody, detailBody])).not.toContain("private/root");
      expect(JSON.stringify([listBody, detailBody])).not.toContain("session_index");
    });
  });
});

async function withApp<T>(
  app: ReturnType<typeof createApp>,
  assertion: (app: ReturnType<typeof createApp>) => Promise<T>,
): Promise<T> {
  return assertion(app);
}

function observation(
  sessionId: string,
  normalized: UsageObservation["normalized"],
): UsageObservation {
  const complete = Object.values(normalized).every((value) => value !== null);
  return {
    observationId: `${sessionId}:observation`,
    sessionId,
    sourcePath: `/private/root/${sessionId}.jsonl`,
    sourceIdentity: "fixture",
    sourceRecordNumber: 2n,
    parserVersion: 3,
    model: "unknown",
    eventTime: null,
    rawCumulative: null,
    rawLast: { input: 0n, cachedInput: 0n, output: 0n },
    normalized,
    epoch: 0,
    method: "standalone_delta",
    complete,
    anomalyCodes: complete ? [] : ["cached_exceeds_input"],
    legacy: false,
  };
}
