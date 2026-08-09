import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import { createApp } from "@/app.js";
import type {
  SessionRelinkErrorResponse,
  SessionRelinkResponse,
} from "@/api/models/linear-response.js";
import type { SessionResponse } from "@/api/models/session-response.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { titleFingerprint } from "@/modules/linear/attribution-state.js";
import { LinearNotConfiguredError } from "@/modules/linear/coordinator.js";
import type { LinearIssueReader, LinearLookupResult } from "@/modules/linear/domain.js";
import { SessionRelinkService } from "@/modules/linear/relink-service.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";

const logger = pino({ enabled: false });
const directories: string[] = [];
const databases: AppDatabase[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function setup(reader?: LinearIssueReader) {
  const directory = await mkdtemp(join(tmpdir(), "linear-api-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  databases.push(database);
  await applyMigrations(database, logger);
  const ingestion = new CodexIngestionRepository(database);
  const issues = new LinearIssueRepository(database.connection);
  const attributions = new LinearSessionAttributionRepository(database.connection);
  const relinking = new SessionRelinkService({
    database,
    sessions: ingestion.sessions,
    attributions,
    issues,
    ...(reader ? { reader } : {}),
  });
  await ingestion.sessions.upsert(
    {
      sessionId: "session-linked",
      sourceRoot: "/private/root",
      sourcePath: "/private/root/session.jsonl",
      title: "ENG-42: apply",
    },
    2,
  );
  await ingestion.usage.ensure("session-linked");
  const synchronizedAt = new Date("2026-08-09T10:00:00.000Z");
  await issues.upsert(
    {
      linearId: "issue-42",
      identifier: "ENG-42",
      title: "Attribute sessions",
      url: "https://linear.app/example/issue/ENG-42",
      team: { id: "team", key: "ENG", name: "Engineering" },
      state: { id: "state", name: "In Progress" },
      updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    },
    synchronizedAt,
  );
  await attributions.save({
    sessionId: "session-linked",
    titleFingerprint: titleFingerprint("ENG-42: apply"),
    candidateIdentifier: "ENG-42",
    phase: "apply",
    status: "linked",
    linearId: "issue-42",
    lastAttemptAt: synchronizedAt,
    lastSuccessAt: synchronizedAt,
  });
  const zeroCounts = {
    unlinked: 0,
    unconfigured: 0,
    pending: 0,
    linked: 1,
    not_found: 0,
    error: 0,
  };
  const app = createApp({
    logger,
    api: {
      ingestion: {
        status: () => Promise.resolve({ roots: [], checkpoints: [], acceptingWork: true }),
        rescan: () =>
          Promise.resolve({ runId: "import-run", state: "queued" as const, coalesced: false }),
      },
      sessions: new SessionQueryService(ingestion.sessions, ingestion.usage, attributions, issues),
      linear: {
        status: () =>
          Promise.resolve({
            configured: true,
            state: "idle" as const,
            acceptingWork: true,
            counts: zeroCounts,
            lastCompletedRun: {
              runId: "linear-run",
              trigger: "manual" as const,
              state: "completed" as const,
              candidateCount: 1,
              linkedCount: 1,
              notFoundCount: 0,
              errorCount: 0,
              completedAt: synchronizedAt,
              createdAt: synchronizedAt,
              updatedAt: synchronizedAt,
            },
          }),
        sync: () =>
          Promise.resolve({ runId: "linear-run", state: "running" as const, coalesced: true }),
        relink: (sessionId) => relinking.relink(sessionId),
      },
    },
  });
  return { app, ingestion, attributions };
}

function found(identifier: string): LinearLookupResult {
  return {
    kind: "found",
    issue: {
      linearId: `issue-${identifier}`,
      identifier,
      title: `Issue ${identifier}`,
      url: `https://linear.app/example/issue/${identifier}`,
      team: { id: "team", key: identifier.split("-")[0]!, name: "Engineering" },
      state: { id: "state", name: "In Progress" },
      updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    },
  };
}

describe("Linear attribution HTTP contract", () => {
  test("returns session attribution, status counts, and coalesced sync acceptance", async () => {
    const opened = await setup();
    await withServer(opened.app, async (server) => {
      const session = await request(server).get("/api/sessions/session-linked");
      const sessionBody = session.body as SessionResponse;
      expect(session.status).toBe(200);
      expect(sessionBody.attribution).toMatchObject({
        status: "linked",
        candidateIdentifier: "ENG-42",
        phase: "apply",
        synchronizationState: "synchronized",
        relinkRequired: false,
        issue: {
          id: "issue-42",
          identifier: "ENG-42",
          title: "Attribute sessions",
          team: { key: "ENG" },
          state: { name: "In Progress" },
        },
      });
      const status = await request(server).get("/api/linear/status");
      expect(status.status).toBe(200);
      expect(status.body).toMatchObject({
        configured: true,
        state: "idle",
        counts: { linked: 1 },
        lastCompletedRun: { runId: "linear-run", linkedCount: 1 },
      });
      const sync = await request(server).post("/api/linear/sync");
      expect(sync.status).toBe(202);
      expect(sync.body).toEqual({ runId: "linear-run", state: "running", coalesced: true });
      const serialized = JSON.stringify([session.body, status.body, sync.body]);
      for (const forbidden of [
        "LINEAR_API_KEY",
        "lin_api_",
        "description",
        "comments",
        "/private/root",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  });

  test("documents and returns the unconfigured synchronization error", async () => {
    const opened = await setup();
    const app = createApp({
      logger,
      api: {
        ingestion: {
          status: () => Promise.resolve({ roots: [], checkpoints: [], acceptingWork: true }),
          rescan: () =>
            Promise.resolve({ runId: "import-run", state: "queued" as const, coalesced: false }),
        },
        sessions: new SessionQueryService(opened.ingestion.sessions, opened.ingestion.usage),
        linear: {
          status: () =>
            Promise.resolve({
              configured: false,
              state: "unconfigured" as const,
              acceptingWork: true,
              counts: {
                unlinked: 0,
                unconfigured: 1,
                pending: 0,
                linked: 0,
                not_found: 0,
                error: 0,
              },
            }),
          sync: () => Promise.reject(new LinearNotConfiguredError()),
          relink: () => Promise.reject(new LinearNotConfiguredError()),
        },
      },
    });
    await withServer(app, async (server) => {
      const status = await request(server).get("/api/linear/status");
      expect(status.body).toMatchObject({ configured: false, state: "unconfigured" });
      const sync = await request(server).post("/api/linear/sync");
      expect(sync.status).toBe(409);
      expect(sync.body).toEqual({
        error: { code: "linear_unconfigured", message: "Linear integration is not configured" },
      });
      const relink = await request(server).post("/api/sessions/session-linked/relink");
      expect(relink.status).toBe(409);
      expect((relink.body as SessionRelinkErrorResponse).error.code).toBe("linear_unconfigured");
    });
  });

  test("relinks a linked or unlinked session only through the explicit endpoint", async () => {
    const opened = await setup({ findIssue: (identifier) => Promise.resolve(found(identifier)) });
    await opened.ingestion.sessions.upsert(
      {
        sessionId: "session-linked",
        sourceRoot: "/private/root",
        sourcePath: "/private/root/session.jsonl",
        title: "ENG-43: apply",
      },
      2,
    );
    await opened.attributions.save({
      sessionId: "session-linked",
      titleFingerprint: titleFingerprint("ENG-43: apply"),
      candidateIdentifier: "ENG-43",
      phase: "apply",
      status: "linked",
      linearId: "issue-42",
    });
    await opened.ingestion.sessions.upsert(
      {
        sessionId: "session-unlinked",
        sourceRoot: "/private/root",
        sourcePath: "/private/root/unlinked.jsonl",
        title: "ENG-44",
      },
      2,
    );
    await opened.ingestion.usage.ensure("session-unlinked");

    await withServer(opened.app, async (server) => {
      const before = await request(server).get("/api/sessions/session-linked");
      expect((before.body as SessionResponse).attribution).toMatchObject({
        candidateIdentifier: "ENG-43",
        issue: { identifier: "ENG-42" },
        relinkRequired: true,
      });

      const linked = await request(server).post("/api/sessions/session-linked/relink");
      expect(linked.status).toBe(200);
      expect((linked.body as SessionRelinkResponse).attribution).toMatchObject({
        status: "linked",
        candidateIdentifier: "ENG-43",
        phase: "apply",
        issue: { identifier: "ENG-43" },
        relinkRequired: false,
      });
      const unlinked = await request(server).post("/api/sessions/session-unlinked/relink");
      expect(unlinked.status).toBe(200);
      expect((unlinked.body as SessionRelinkResponse).attribution).toMatchObject({
        status: "linked",
        candidateIdentifier: "ENG-44",
        issue: { identifier: "ENG-44" },
      });
    });
  });

  test("rejects missing, absent, and failed relink candidates while preserving the stored link", async () => {
    let outcome: LinearLookupResult = { kind: "not_found" };
    let calls = 0;
    const opened = await setup({
      findIssue: () => {
        calls += 1;
        return Promise.resolve(outcome);
      },
    });
    await withServer(opened.app, async (server) => {
      await opened.ingestion.sessions.upsert(
        {
          sessionId: "session-linked",
          sourceRoot: "/private/root",
          sourcePath: "/private/root/session.jsonl",
          title: "ordinary title",
        },
        2,
      );
      const missing = await request(server).post("/api/sessions/session-linked/relink");
      expect(missing.status).toBe(422);
      expect((missing.body as SessionRelinkErrorResponse).error.code).toBe(
        "linear_relink_candidate_missing",
      );
      expect(calls).toBe(0);

      await opened.ingestion.sessions.upsert(
        {
          sessionId: "session-linked",
          sourceRoot: "/private/root",
          sourcePath: "/private/root/session.jsonl",
          title: "ENG-404",
        },
        2,
      );
      const notFound = await request(server).post("/api/sessions/session-linked/relink");
      expect(notFound.status).toBe(404);
      expect((notFound.body as SessionRelinkErrorResponse).error.code).toBe(
        "linear_relink_not_found",
      );

      for (const category of [
        "authentication",
        "identifier_mismatch",
        "network",
        "timeout",
        "rate_limit",
        "upstream",
      ] as const) {
        outcome = { kind: "error", category };
        const failed = await request(server).post("/api/sessions/session-linked/relink");
        expect(failed.status).toBe(
          ["network", "timeout", "rate_limit", "upstream"].includes(category) ? 503 : 502,
        );
        expect((failed.body as SessionRelinkErrorResponse).error).toMatchObject({
          code: `linear_relink_${category}`,
          failureCategory: category,
        });
      }

      const attribution = await opened.attributions.findBySessionId("session-linked");
      expect(attribution).toMatchObject({ status: "linked", linearId: "issue-42" });
    });
  });

  test("rejects a stale relink when the title changes during lookup", async () => {
    let release!: () => void;
    let lookupStarted = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const opened = await setup({
      findIssue: async (identifier) => {
        lookupStarted = true;
        await pending;
        return found(identifier);
      },
    });
    await opened.ingestion.sessions.upsert(
      {
        sessionId: "session-linked",
        sourceRoot: "/private/root",
        sourcePath: "/private/root/session.jsonl",
        title: "ENG-43",
      },
      2,
    );
    await withServer(opened.app, async (server) => {
      const responsePromise = request(server)
        .post("/api/sessions/session-linked/relink")
        .then((response) => response);
      while (!lookupStarted) await Bun.sleep(2);
      await opened.ingestion.sessions.upsert(
        {
          sessionId: "session-linked",
          sourceRoot: "/private/root",
          sourcePath: "/private/root/session.jsonl",
          title: "ENG-44",
        },
        2,
      );
      release();
      const response = await responsePromise;
      expect(response.status).toBe(409);
      expect((response.body as SessionRelinkErrorResponse).error.code).toBe(
        "linear_relink_stale_title",
      );
      expect(await opened.attributions.findBySessionId("session-linked")).toMatchObject({
        status: "linked",
        linearId: "issue-42",
      });
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
