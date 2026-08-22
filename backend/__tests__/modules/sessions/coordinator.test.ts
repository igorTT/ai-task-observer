import { appendFile, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { IngestionCoordinator } from "@/modules/sessions/coordinator.js";
import { discoverRoot, type RootDiscoveryStatus } from "@/modules/sessions/discovery.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const directories: string[] = [];
const coordinators: IngestionCoordinator[] = [];
const databases: AppDatabase[] = [];
const logger = pino({ enabled: false });

async function setup(
  roots: readonly string[],
  discover?: (root: string) => Promise<RootDiscoveryStatus>,
  afterCommit?: (sessionIds: readonly string[], indexPath: string) => void | Promise<void>,
): Promise<{
  database: AppDatabase;
  repository: CodexIngestionRepository;
  coordinator: IngestionCoordinator;
  indexPath: string;
  committed: string[][];
}> {
  const directory = await mkdtemp(join(tmpdir(), "codex-coordinator-db-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  databases.push(database);
  await applyMigrations(database, logger);
  const repository = new CodexIngestionRepository(database);
  const indexPath = join(directory, "session_index.jsonl");
  const committed: string[][] = [];
  const importer = new CodexSourceImporter({ repository, readChunkBytes: 256, logger });
  const coordinator = new IngestionCoordinator({
    roots,
    sessionIndexPath: indexPath,
    importer,
    repository,
    logger,
    debounceMs: 20,
    rediscoveryMs: 30,
    watchUsePolling: true,
    ...(discover ? { discover } : {}),
    onSessionsCommitted: async (sessionIds) => {
      committed.push([...sessionIds]);
      await afterCommit?.(sessionIds, indexPath);
    },
  });
  coordinators.push(coordinator);
  return { database, repository, coordinator, indexPath, committed };
}

afterEach(async () => {
  await Promise.all(coordinators.splice(0).map(async (coordinator) => coordinator.close()));
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("ingestion coordinator", () => {
  test("backfills existing sessions from the index without creating orphan sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-index-startup-"));
    directories.push(root);
    await copyFile(fixture, join(root, "session.jsonl"));
    const opened = await setup([root]);
    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-999: indexed",
      updated_at: "2026-01-03T03:10:00.000Z",
    });
    await opened.coordinator.start();

    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      currentTitle: "ENG-999: indexed",
      developerTurns: 1n,
    });
    expect(await opened.repository.sessions.findById("orphan")).toBeUndefined();
    expect(opened.committed).toEqual([["session-001"], ["session-001"]]);
  });

  test("reconciles an index replacement that happens before the watcher reaches ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-index-ready-race-"));
    directories.push(root);
    await copyFile(fixture, join(root, "session.jsonl"));
    let commits = 0;
    const opened = await setup([root], undefined, async (_sessionIds, indexPath) => {
      commits += 1;
      if (commits === 2) {
        await writeIndex(indexPath, {
          id: "session-001",
          thread_name: "ENG-101: ready-race-update",
          updated_at: "2026-01-03T03:11:00.000Z",
        });
      }
    });
    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-101: initial-index-title",
      updated_at: "2026-01-03T03:10:00.000Z",
    });

    await opened.coordinator.start();

    expect(commits).toBe(3);
    expect((await opened.repository.sessions.findById("session-001"))?.currentTitle).toBe(
      "ENG-101: ready-race-update",
    );
  });

  test("reconciles an index-only rename during an explicit rescan", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-index-rescan-"));
    directories.push(root);
    await copyFile(fixture, join(root, "session.jsonl"));
    const opened = await setup([root]);
    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-101: apply",
      updated_at: "2026-01-03T03:10:00.000Z",
    });
    await opened.coordinator.start();
    const before = await opened.repository.usage.findBySessionId("session-001");

    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-101: verify",
      updated_at: "2026-01-03T03:11:00.000Z",
    });
    await opened.coordinator.rescan();
    await waitForIdle(opened.coordinator);

    expect((await opened.repository.sessions.findById("session-001"))?.currentTitle).toBe(
      "ENG-101: verify",
    );
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject({
      inputTokens: before?.inputTokens,
      totalTokens: before?.totalTokens,
    });
  });

  test("watches index-only renames, preserves titles on malformed input, and clears valid empty names", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-index-watch-"));
    directories.push(root);
    await copyFile(fixture, join(root, "session.jsonl"));
    const opened = await setup([root]);
    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-101: apply",
      updated_at: "2026-01-03T03:10:00.000Z",
    });
    await opened.coordinator.start();

    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "ENG-101: verify",
      updated_at: "2026-01-03T03:11:00.000Z",
    });
    await waitFor(
      async () =>
        (await opened.repository.sessions.findById("session-001"))?.currentTitle ===
        "ENG-101: verify",
    );

    await writeFile(opened.indexPath, '{"id":"broken"\n');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await opened.repository.sessions.findById("session-001"))?.currentTitle).toBe(
      "ENG-101: verify",
    );

    await writeIndex(opened.indexPath, {
      id: "session-001",
      thread_name: "",
      updated_at: "2026-01-03T03:12:00.000Z",
    });
    await waitFor(
      async () =>
        (await opened.repository.sessions.findById("session-001"))?.currentTitle === undefined,
    );
  });

  test("watches new files, debounces duplicate notifications, and shuts down cleanly", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-watcher-"));
    directories.push(root);
    const opened = await setup([root]);
    const starting = opened.coordinator.start();
    const path = join(root, "created.jsonl");
    await copyFile(fixture, path);
    await starting;
    await waitFor(async () => (await opened.repository.sessions.count()) === 1);
    const before = (await opened.repository.sessions.findById("session-001"))?.developerTurns;
    await appendFile(
      path,
      `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "private" } })}\n`,
    );
    await Promise.all([appendFile(path, ""), appendFile(path, ""), appendFile(path, "")]);
    await waitFor(
      async () => (await opened.repository.sessions.findById("session-001"))?.developerTurns === 2n,
    );
    expect(before).toBe(1n);
    await opened.coordinator.close();
    expect((await opened.coordinator.status()).acceptingWork).toBe(false);
    expect(opened.coordinator.rescan()).rejects.toThrow("shutting down");
  });

  test("discovers a missing root that appears later and backfills it", async () => {
    const parent = await mkdtemp(join(tmpdir(), "codex-late-root-"));
    directories.push(parent);
    const root = join(parent, "sessions");
    const opened = await setup([root]);
    await opened.coordinator.start();
    expect((await opened.coordinator.status()).roots[0]).toMatchObject({
      available: false,
      reason: "missing",
    });
    await mkdir(root);
    await copyFile(fixture, join(root, "late.jsonl"));
    await waitFor(async () => (await opened.repository.sessions.count()) === 1);
    expect((await opened.coordinator.status()).roots[0]?.available).toBe(true);
  });

  test("reconciles files hidden by Chokidar's ignored initial scan", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-watch-reconcile-"));
    directories.push(root);
    await copyFile(fixture, join(root, "during-watch-startup.jsonl"));
    let discoveryCalls = 0;
    const opened = await setup([root], async (configuredRoot) => {
      discoveryCalls += 1;
      if (discoveryCalls === 1) {
        return { root: configuredRoot, available: true, files: [] };
      }
      return discoverRoot(configuredRoot);
    });

    await opened.coordinator.start();
    expect(discoveryCalls).toBe(2);
    expect(await opened.repository.sessions.count()).toBe(1);
    expect(await opened.repository.sessions.findById("session-001")).toBeDefined();
  });

  test("keeps multiple roots independent and isolates a failing source", async () => {
    const parent = await mkdtemp(join(tmpdir(), "codex-multiple-roots-"));
    directories.push(parent);
    const one = join(parent, "one");
    const two = join(parent, "two");
    await Promise.all([mkdir(one), mkdir(two)]);
    await copyFile(fixture, join(one, "valid.jsonl"));
    await writeFile(
      join(two, "invalid.jsonl"),
      `${JSON.stringify({ type: "turn_context", payload: { private: "secret" } })}\n`,
    );
    const opened = await setup([one, two]);
    await opened.coordinator.start();
    await waitFor(async () => (await opened.repository.sessions.count()) === 1);
    await waitFor(async () => (await opened.coordinator.status()).lastCompletedRun !== undefined);
    const status = await opened.coordinator.status();
    expect(status.roots).toHaveLength(2);
    expect(status.lastCompletedRun?.errors).toBe(1);
  });

  test("coalesces concurrent rescans onto one stable run identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-rescan-"));
    directories.push(root);
    await copyFile(fixture, join(root, "session.jsonl"));
    const opened = await setup([root]);
    await opened.coordinator.start();
    await appendFile(
      join(root, "session.jsonl"),
      `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "private" } })}\n`,
    );
    const firstPromise = opened.coordinator.rescan();
    const secondPromise = opened.coordinator.rescan();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(second.runId).toBe(first.runId);
    expect([first.coalesced, second.coalesced].sort()).toEqual([false, true]);
  });
});

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for ingestion state");
}

async function waitForIdle(coordinator: IngestionCoordinator): Promise<void> {
  await waitFor(async () => (await coordinator.status()).currentRun === undefined);
}

async function writeIndex(
  path: string,
  record: { id: string; thread_name: string; updated_at: string },
): Promise<void> {
  await writeFile(path, `${JSON.stringify(record)}\n`);
}
