import { appendFile, copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "bun:test";
import type { FSWatcher } from "chokidar";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import {
  IngestionCoordinator,
  type IngestionCoordinatorOptions,
} from "@/modules/sessions/coordinator.js";
import { discoverRoot, type RootDiscoveryStatus } from "@/modules/sessions/discovery.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const directories: string[] = [];
const coordinators: IngestionCoordinator[] = [];
const databases: AppDatabase[] = [];
const logger = pino({ enabled: false });

interface CoordinatorTestOptions {
  readonly rediscoveryMs?: number;
  readonly watchFactory?: IngestionCoordinatorOptions["watchFactory"];
}

async function setup(
  roots: readonly string[],
  discover?: (root: string) => Promise<RootDiscoveryStatus>,
  afterCommit?: (sessionIds: readonly string[], indexPath: string) => void | Promise<void>,
  options: CoordinatorTestOptions = {},
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
    rediscoveryMs: options.rediscoveryMs ?? 30,
    watchUsePolling: true,
    ...(discover ? { discover } : {}),
    ...(options.watchFactory ? { watchFactory: options.watchFactory } : {}),
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
    expect(discoveryCalls).toBeGreaterThanOrEqual(2);
    expect(await opened.repository.sessions.count()).toBe(1);
    expect(await opened.repository.sessions.findById("session-001")).toBeDefined();
  });

  test("recovers a missed append through the sweep and commits it once", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-recovery-append-"));
    directories.push(root);
    const path = join(root, "session.jsonl");
    await copyFile(fixture, path);
    const canonicalPath = await realpath(path);
    const opened = await setup([root], undefined, undefined, {
      rediscoveryMs: 20,
      watchFactory: silentWatchFactory(),
    });
    await opened.coordinator.start();

    const beforeCheckpoint = await opened.repository.checkpoints.find(canonicalPath);
    const beforeUsage = await opened.repository.usage.findBySessionId("session-001");
    await appendFile(
      path,
      `${JSON.stringify({
        timestamp: "2026-01-02T03:11:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: { input_tokens: 200, cached_input_tokens: 30, output_tokens: 50 },
            last_token_usage: { input_tokens: 50, cached_input_tokens: 5, output_tokens: 10 },
          },
        },
      })}\n`,
    );

    await waitFor(
      async () =>
        (await opened.repository.usage.findBySessionId("session-001"))?.totalTokens === 250n,
    );
    const afterImportCheckpoint = await opened.repository.checkpoints.find(canonicalPath);
    const afterImportUsage = await opened.repository.usage.findBySessionId("session-001");
    expect(afterImportCheckpoint).toBeDefined();
    expect(afterImportUsage).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(afterImportCheckpoint?.committedOffset).toBeGreaterThan(
      beforeCheckpoint?.committedOffset ?? 0n,
    );
    expect(afterImportUsage).toMatchObject({
      totalTokens: 250n,
      factRevision: (beforeUsage?.factRevision ?? 0n) + 1n,
    });
    expect((await opened.repository.sessions.findById("session-001"))?.developerTurns).toBe(1n);
    expect(await opened.repository.checkpoints.find(canonicalPath)).toMatchObject(
      afterImportCheckpoint!,
    );
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject(
      afterImportUsage!,
    );
  });

  test("recovers a missed nested-file creation through the sweep", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-recovery-create-"));
    directories.push(root);
    const opened = await setup([root], undefined, undefined, {
      rediscoveryMs: 20,
      watchFactory: silentWatchFactory(),
    });
    await opened.coordinator.start();

    const nested = join(root, "nested", "active.jsonl");
    await mkdir(join(root, "nested"));
    await copyFile(fixture, nested);

    await waitFor(
      async () => (await opened.repository.sessions.findById("session-001"))?.developerTurns === 1n,
    );
    expect((await opened.repository.sessions.findById("session-001"))?.developerTurns).toBe(1n);
  });

  test("coalesces overlapping recovery sweeps and stops the timer on shutdown", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-recovery-overlap-"));
    directories.push(root);
    let activeDiscoveries = 0;
    let maximumActiveDiscoveries = 0;
    let discoveryCalls = 0;
    const discover = async (configuredRoot: string): Promise<RootDiscoveryStatus> => {
      discoveryCalls += 1;
      activeDiscoveries += 1;
      maximumActiveDiscoveries = Math.max(maximumActiveDiscoveries, activeDiscoveries);
      await new Promise((resolve) => setTimeout(resolve, 35));
      activeDiscoveries -= 1;
      return discoverRoot(configuredRoot);
    };
    const opened = await setup([root], discover, undefined, {
      rediscoveryMs: 10,
      watchFactory: silentWatchFactory(),
    });
    await opened.coordinator.start();
    await waitFor(() => Promise.resolve(discoveryCalls >= 5), 3_000);
    expect(maximumActiveDiscoveries).toBe(1);

    await opened.coordinator.close();
    const callsAfterClose = discoveryCalls;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(discoveryCalls).toBe(callsAfterClose);
  });

  test("isolates a recovery discovery failure from an unrelated root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "codex-recovery-failure-"));
    directories.push(parent);
    const failingRoot = join(parent, "failing");
    const healthyRoot = join(parent, "healthy");
    await Promise.all([mkdir(failingRoot), mkdir(healthyRoot)]);
    let failRecovery = false;
    const discover = async (configuredRoot: string): Promise<RootDiscoveryStatus> => {
      if (failRecovery && configuredRoot === failingRoot) throw new Error("synthetic failure");
      return discoverRoot(configuredRoot);
    };
    const opened = await setup([failingRoot, healthyRoot], discover, undefined, {
      rediscoveryMs: 20,
      watchFactory: silentWatchFactory(),
    });
    await opened.coordinator.start();
    failRecovery = true;
    await copyFile(fixture, join(healthyRoot, "recovered.jsonl"));

    await waitFor(async () => (await opened.repository.sessions.count()) === 1);
    expect((await opened.coordinator.status()).roots).toMatchObject([
      { available: false, reason: "unreadable" },
      { available: true },
    ]);
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

function silentWatchFactory(): NonNullable<IngestionCoordinatorOptions["watchFactory"]> {
  return () => {
    const watcher = new EventEmitter();
    const close = (): Promise<void> => Promise.resolve();
    queueMicrotask(() => watcher.emit("ready"));
    return Object.assign(watcher, { close }) as unknown as FSWatcher;
  };
}
