import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, mock, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import type { SessionResponse } from "@/api/models/session-response.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { LinearSyncRunRepository } from "@/database/repositories/linear-sync-run-repository.js";
import { AttributionCoordinator } from "@/modules/linear/coordinator.js";
import type { LinearIssueReader } from "@/modules/linear/domain.js";
import { startServer, type ServerFactories } from "@/server.js";

test("imports a renamed historical session and preserves durable attribution across restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "linear-server-e2e-"));
  const root = join(directory, "sessions");
  const source = join(root, "session.jsonl");
  const databasePath = join(directory, "observer.duckdb");
  await mkdir(root, { recursive: true });
  await writeFile(
    source,
    `${JSON.stringify({
      timestamp: "2026-08-09T08:00:00.000Z",
      type: "session_meta",
      payload: { id: "durable-session", title: "New chat" },
    })}\n`,
  );
  const findIssue = mock((identifier: string) =>
    Promise.resolve({
      kind: "found" as const,
      issue: {
        linearId: "linear-77",
        identifier,
        title: "Durable attribution",
        url: "https://linear.app/example/issue/ENG-77",
        team: { id: "team", key: "ENG", name: "Engineering" },
        state: { id: "state", name: "In Progress" },
        updatedAt: new Date("2026-08-09T09:00:00.000Z"),
      },
    }),
  );
  const reader: LinearIssueReader = { findIssue };
  const factories: ServerFactories = {
    createAttribution: (config, database) =>
      new AttributionCoordinator({
        database,
        sessions: new CodexSessionRepository(database.connection),
        attributions: new LinearSessionAttributionRepository(database.connection),
        issues: new LinearIssueRepository(database.connection),
        runs: new LinearSyncRunRepository(database.connection),
        ...(config.linearApiKey ? { reader } : {}),
        logger: pino({ enabled: false }),
        cacheTtlMs: config.linearCacheTtlMs,
        maxConcurrency: config.linearMaxConcurrency,
      }),
  };
  const environment = {
    HOST: "127.0.0.1",
    PORT: String(30_000 + Math.floor(Math.random() * 20_000)),
    DATABASE_PATH: databasePath,
    CODEX_SESSION_ROOTS: root,
    CODEX_WATCH_DEBOUNCE_MS: "10",
    CODEX_ROOT_REDISCOVERY_MS: "1000",
    LINEAR_API_KEY: "lin_api_fixture_key",
    LOG_LEVEL: "silent",
  };

  try {
    const first = await startServer(environment, factories);
    try {
      await waitForIdle(first.attribution);
      expect((await request(first.httpServer).get("/api/health")).body).toEqual({
        status: "healthy",
      });
      const unlinked = await request(first.httpServer).get("/api/sessions/durable-session");
      expect((unlinked.body as SessionResponse).attribution).toMatchObject({ status: "unlinked" });

      await appendFile(
        source,
        `${JSON.stringify({ type: "session_title", payload: { title: "ENG-77: apply" } })}\n`,
      );
      await first.ingestion.rescan();
      await waitForIngestion(first.ingestion);
      expect(
        (await new CodexSessionRepository(first.database.connection).findById("durable-session"))
          ?.currentTitle,
      ).toBe("ENG-77: apply");
      await waitForIdle(first.attribution);
      const attributed = await request(first.httpServer).get("/api/sessions/durable-session");
      expect((attributed.body as SessionResponse).attribution).toMatchObject({
        status: "linked",
        candidateIdentifier: "ENG-77",
        phase: "apply",
        issue: { id: "linear-77", title: "Durable attribution" },
      });
      expect(JSON.stringify(attributed.body)).not.toContain("lin_api_fixture_key");
    } finally {
      await first.close();
    }

    const callsAfterFirstRun = findIssue.mock.calls.length;
    const second = await startServer(
      { ...environment, PORT: String(Number(environment.PORT) + 1) },
      factories,
    );
    try {
      await waitForIdle(second.attribution);
      const durable = await request(second.httpServer).get("/api/sessions/durable-session");
      expect((durable.body as SessionResponse).attribution).toMatchObject({
        status: "linked",
        candidateIdentifier: "ENG-77",
        issue: { id: "linear-77" },
      });
      expect(findIssue).toHaveBeenCalledTimes(callsAfterFirstRun);
      const status = await request(second.httpServer).get("/api/linear/status");
      expect(status.body).toMatchObject({ configured: true, counts: { linked: 1 } });
    } finally {
      await second.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function waitForIdle(attribution: { status: () => Promise<{ currentRun?: unknown }> }) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (!(await attribution.status()).currentRun) return;
    await Bun.sleep(5);
  }
  throw new Error("Attribution did not become idle");
}

async function waitForIngestion(ingestion: { status: () => Promise<{ currentRun?: unknown }> }) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (!(await ingestion.status()).currentRun) return;
    await Bun.sleep(5);
  }
  throw new Error("Ingestion did not become idle");
}
