import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, mock, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { LinearSyncRunRepository } from "@/database/repositories/linear-sync-run-repository.js";
import { AttributionCoordinator } from "@/modules/linear/coordinator.js";
import type { LinearIssueReader, LinearLookupResult } from "@/modules/linear/domain.js";

const directories: string[] = [];
const databases: AppDatabase[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function setup(
  titles: readonly string[],
  reader?: LinearIssueReader,
  options: { now?: () => Date; cacheTtlMs?: number; maxConcurrency?: number } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "attribution-coordinator-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  databases.push(database);
  await applyMigrations(database, pino({ enabled: false }));
  const ingestion = new CodexIngestionRepository(database);
  for (const [index, title] of titles.entries()) {
    const sessionId = `session-${index + 1}`;
    await ingestion.sessions.upsert(
      { sessionId, sourceRoot: "/root", sourcePath: `/root/${sessionId}.jsonl`, title },
      2,
    );
    await ingestion.usage.ensure(sessionId);
    await ingestion.usage.replaceTokens(sessionId, { input: 10n, cachedInput: 2n, output: 3n });
  }
  const attributions = new LinearSessionAttributionRepository(database.connection);
  const issues = new LinearIssueRepository(database.connection);
  const runs = new LinearSyncRunRepository(database.connection);
  const coordinator = new AttributionCoordinator({
    database,
    sessions: ingestion.sessions,
    attributions,
    issues,
    runs,
    ...(reader ? { reader } : {}),
    logger: pino({ enabled: false }),
    cacheTtlMs: options.cacheTtlMs ?? 60_000,
    maxConcurrency: options.maxConcurrency ?? 2,
    ...(options.now ? { now: options.now } : {}),
  });
  return { database, ingestion, attributions, issues, runs, coordinator };
}

function found(identifier: string, title = "Issue"): LinearLookupResult {
  return {
    kind: "found",
    issue: {
      linearId: `id-${identifier}`,
      identifier,
      title,
      url: `https://linear.app/example/issue/${identifier}`,
      team: { id: "team", key: identifier.split("-")[0]!, name: "Engineering" },
      state: { id: "state", name: "In Progress" },
      updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    },
  };
}

async function waitForIdle(coordinator: AttributionCoordinator): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (!(await coordinator.status()).currentRun) return;
    await Bun.sleep(5);
  }
  throw new Error("Coordinator did not become idle");
}

describe("AttributionCoordinator", () => {
  test("backfills, deduplicates duplicate candidates, and coalesces a manual run", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const findIssue = mock(async (identifier: string) => {
      await pending;
      return found(identifier);
    });
    const opened = await setup(["ENG-1: explore", "ENG-1: apply"], { findIssue });
    await opened.coordinator.start();
    const active = await opened.coordinator.status();
    expect(active.currentRun?.trigger).toBe("startup");
    const coalesced = await opened.coordinator.sync();
    expect(coalesced).toMatchObject({ runId: active.currentRun?.runId, coalesced: true });
    release();
    await waitForIdle(opened.coordinator);
    expect(findIssue).toHaveBeenCalledTimes(1);
    expect((await opened.attributions.list()).map((item) => item.status)).toEqual([
      "linked",
      "linked",
    ]);
    await opened.coordinator.close();
  });

  test("rechecks title fingerprints and preserves ingestion facts during an in-flight rename", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const findIssue = mock(async (identifier: string) => {
      if (identifier === "ENG-1") {
        await pending;
        return { kind: "not_found" } as const;
      }
      return found(identifier);
    });
    const opened = await setup(["ENG-1: explore"], { findIssue });
    await opened.coordinator.start();
    while (findIssue.mock.calls.length === 0) await Bun.sleep(2);
    await opened.ingestion.sessions.upsert(
      {
        sessionId: "session-1",
        sourceRoot: "/root",
        sourcePath: "/root/session-1.jsonl",
        title: "ENG-2: apply",
      },
      2,
    );
    await opened.coordinator.notifySessions(["session-1"]);
    release();
    await waitForIdle(opened.coordinator);
    expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
      status: "linked",
      candidateIdentifier: "ENG-2",
      phase: "apply",
    });
    expect(await opened.ingestion.usage.findBySessionId("session-1")).toMatchObject({
      totalTokens: 13n,
    });
    await opened.coordinator.close();
  });

  test("keeps candidates unconfigured without calls and later recovers from not found", async () => {
    const unconfigured = await setup(["ENG-3"]);
    await unconfigured.coordinator.start();
    await waitForIdle(unconfigured.coordinator);
    expect(await unconfigured.attributions.findBySessionId("session-1")).toMatchObject({
      status: "unconfigured",
      candidateIdentifier: "ENG-3",
    });
    expect(unconfigured.coordinator.sync()).rejects.toThrow("not configured");
    await unconfigured.coordinator.close();

    let attempt = 0;
    const configured = await setup(["ENG-4"], {
      findIssue: (identifier) =>
        Promise.resolve(++attempt === 1 ? { kind: "not_found" } : found(identifier)),
    });
    await configured.coordinator.start();
    await waitForIdle(configured.coordinator);
    expect(await configured.attributions.findBySessionId("session-1")).toMatchObject({
      status: "not_found",
    });
    await configured.coordinator.sync();
    await waitForIdle(configured.coordinator);
    expect(await configured.attributions.findBySessionId("session-1")).toMatchObject({
      status: "linked",
      linearId: "id-ENG-4",
    });
    await configured.coordinator.close();
  });

  test("refreshes stale cache, isolates partial failures, and stops a run on authentication", async () => {
    let now = new Date("2026-08-09T10:00:00.000Z");
    const outcomes = new Map<string, LinearLookupResult>([
      ["ENG-1", found("ENG-1", "Initial")],
      ["ENG-2", { kind: "not_found" }],
      ["ENG-3", { kind: "error", category: "network" }],
    ]);
    const opened = await setup(
      ["ENG-1", "ENG-2", "ENG-3"],
      { findIssue: (identifier) => Promise.resolve(outcomes.get(identifier)!) },
      { now: () => now, cacheTtlMs: 1_000 },
    );
    await opened.coordinator.start();
    await waitForIdle(opened.coordinator);
    expect((await opened.attributions.list()).map((item) => item.status)).toEqual([
      "linked",
      "not_found",
      "error",
    ]);
    now = new Date("2026-08-09T10:00:02.000Z");
    outcomes.set("ENG-1", { kind: "error", category: "timeout" });
    outcomes.set("ENG-2", found("ENG-2"));
    outcomes.set("ENG-3", found("ENG-3"));
    await opened.coordinator.sync();
    await waitForIdle(opened.coordinator);
    expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
      status: "linked",
      failureCategory: "timeout",
      linearId: "id-ENG-1",
    });
    expect((await opened.attributions.list()).slice(1).map((item) => item.status)).toEqual([
      "linked",
      "linked",
    ]);
    await opened.coordinator.close();

    const calls: string[] = [];
    const auth = await setup(
      ["ENG-1", "ENG-2"],
      {
        findIssue: (identifier) => {
          calls.push(identifier);
          return Promise.resolve({ kind: "error", category: "authentication" });
        },
      },
      { maxConcurrency: 1 },
    );
    await auth.coordinator.start();
    await waitForIdle(auth.coordinator);
    expect(calls).toEqual(["ENG-1"]);
    expect((await auth.runs.latestCompleted())?.state).toBe("failed");
    await auth.coordinator.close();
  });

  test("waits for active work during graceful shutdown and rejects new manual work", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const opened = await setup(["ENG-9"], {
      findIssue: async (identifier) => {
        await pending;
        return found(identifier);
      },
    });
    await opened.coordinator.start();
    const closing = opened.coordinator.close();
    expect(opened.coordinator.sync()).rejects.toThrow("shutting down");
    release();
    await closing;
    expect((await opened.coordinator.status()).acceptingWork).toBe(false);
  });

  test("keeps a stored link sticky across candidate, phase, and ordinary-title changes", async () => {
    const calls: string[] = [];
    const opened = await setup(["ENG-215: explore"], {
      findIssue: (identifier) => {
        calls.push(identifier);
        return Promise.resolve(found(identifier));
      },
    });
    await opened.coordinator.start();
    await waitForIdle(opened.coordinator);

    for (const title of ["ENG-216: apply", "ordinary title", "ENG-215: verify"]) {
      await opened.ingestion.sessions.upsert(
        {
          sessionId: "session-1",
          sourceRoot: "/root",
          sourcePath: "/root/session-1.jsonl",
          title,
        },
        2,
      );
      await opened.coordinator.notifySessions(["session-1"]);
      await waitForIdle(opened.coordinator);
      expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
        status: "linked",
        linearId: "id-ENG-215",
      });
    }

    expect(calls).toEqual(["ENG-215"]);
    expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
      candidateIdentifier: "ENG-215",
      phase: "verify",
    });
    await opened.coordinator.close();
  });

  test("refreshes a renamed linked session by stored identity and only relinks explicitly", async () => {
    let now = new Date("2026-08-09T10:00:00.000Z");
    const calls: string[] = [];
    const opened = await setup(
      ["ENG-215"],
      {
        findIssue: (identifier) => {
          calls.push(identifier);
          return Promise.resolve(found(identifier, `Issue ${calls.length}`));
        },
      },
      { now: () => now, cacheTtlMs: 1_000 },
    );
    await opened.coordinator.start();
    await waitForIdle(opened.coordinator);
    await opened.ingestion.sessions.upsert(
      {
        sessionId: "session-1",
        sourceRoot: "/root",
        sourcePath: "/root/session-1.jsonl",
        title: "ENG-216: apply",
      },
      2,
    );
    await opened.coordinator.notifySessions(["session-1"]);
    await waitForIdle(opened.coordinator);
    expect(calls).toEqual(["ENG-215"]);

    now = new Date("2026-08-09T10:00:02.000Z");
    await opened.coordinator.sync();
    await waitForIdle(opened.coordinator);
    expect(calls).toEqual(["ENG-215", "ENG-215"]);
    expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
      candidateIdentifier: "ENG-216",
      linearId: "id-ENG-215",
    });

    await opened.coordinator.relink("session-1");
    expect(calls).toEqual(["ENG-215", "ENG-215", "ENG-216"]);
    expect(await opened.attributions.findBySessionId("session-1")).toMatchObject({
      status: "linked",
      candidateIdentifier: "ENG-216",
      phase: "apply",
      linearId: "id-ENG-216",
    });
    await opened.coordinator.close();
  });
});
