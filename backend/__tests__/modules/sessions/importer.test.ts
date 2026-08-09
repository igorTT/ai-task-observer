import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { discoverRoot } from "@/modules/sessions/discovery.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const directories: string[] = [];
const logger = pino({ enabled: false });

async function setup(parserVersion = 2): Promise<{
  database: AppDatabase;
  repository: CodexIngestionRepository;
  importer: CodexSourceImporter;
  root: string;
  path: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "codex-importer-"));
  directories.push(directory);
  const root = join(directory, "sessions");
  await mkdir(join(root, "2026", "01"), { recursive: true });
  const path = join(root, "2026", "01", "rollout-session.jsonl");
  await copyFile(fixture, path);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  await applyMigrations(database, logger);
  const repository = new CodexIngestionRepository(database);
  return {
    database,
    repository,
    importer: new CodexSourceImporter({ repository, readChunkBytes: 128, logger, parserVersion }),
    root,
    path,
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Codex source importer", () => {
  test("backfills nested sources, remains idempotent, and imports appended complete records once", async () => {
    const opened = await setup();
    expect((await discoverRoot(opened.root)).files).toEqual([await realpath(opened.path)]);
    const first = await opened.importer.importSource(opened.root, opened.path);
    expect(first).toMatchObject({ state: "imported", rebuilt: true, sessions: ["session-001"] });
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      currentTitle: "ENG-101: apply",
      developerTurns: 1n,
      importState: "ready",
    });
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject({
      inputTokens: 150n,
      cachedInputTokens: 25n,
      outputTokens: 40n,
      totalTokens: 215n,
    });
    expect((await opened.importer.importSource(opened.root, opened.path)).state).toBe("unchanged");

    await appendFile(
      opened.path,
      `${JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "private" } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 200, cached_input_tokens: 30, output_tokens: 50 } } } })}\n`,
    );
    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      developerTurns: 2n,
    });
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject({
      totalTokens: 280n,
    });
    await opened.importer.importSource(opened.root, opened.path);
    expect((await opened.repository.sessions.findById("session-001"))?.developerTurns).toBe(2n);
    opened.database.close();
  });

  test("defers a trailing fragment and replays it exactly once after completion", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const before = await opened.repository.checkpoints.find(opened.path);
    await appendFile(opened.path, '{"type":"event_msg","payload":{"type":"user_message"');
    await opened.importer.importSource(opened.root, opened.path);
    expect((await opened.repository.checkpoints.find(opened.path))?.committedOffset).toBe(
      before?.committedOffset,
    );
    await appendFile(opened.path, ',"message":"private"}}\n');
    await opened.importer.importSource(opened.root, opened.path);
    expect((await opened.repository.sessions.findById("session-001"))?.developerTurns).toBe(2n);
    opened.database.close();
  });

  test("rebuilds on truncation and preserves the previous snapshot on failed replacement", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    await writeFile(
      opened.path,
      `${JSON.stringify({ type: "session_meta", payload: { id: "session-001", title: "rebuilt" } })}\n`,
    );
    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      currentTitle: "rebuilt",
      developerTurns: 0n,
    });
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject({
      totalTokens: 0n,
      usageObserved: false,
    });

    const replacement = join(opened.root, "replacement.jsonl");
    await writeFile(replacement, `${JSON.stringify({ type: "turn_context", payload: {} })}\n`);
    await rename(replacement, opened.path);
    expect(opened.importer.importSource(opened.root, opened.path)).rejects.toThrow(
      "stable session identity",
    );
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      currentTitle: "rebuilt",
      importState: "stale",
    });
    opened.database.close();
  });

  test("atomically replaces the path owner when a replacement has a new session identity", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const replacement = join(opened.root, "new-session.jsonl");
    await writeFile(
      replacement,
      [
        JSON.stringify({
          type: "session_meta",
          payload: { id: "session-002", title: "ENG-202: apply" },
        }),
        JSON.stringify({
          type: "event_msg",
          payload: { type: "user_message", message: "private" },
        }),
        JSON.stringify({
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: {
                input_tokens: 2,
                cached_input_tokens: 1,
                output_tokens: 3,
              },
            },
          },
        }),
      ].join("\n") + "\n",
    );
    await rename(replacement, opened.path);

    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.sessions.count()).toBe(1);
    expect(await opened.repository.sessions.findById("session-001")).toBeUndefined();
    expect(await opened.repository.sessions.findById("session-002")).toMatchObject({
      sourcePath: opened.path,
      currentTitle: "ENG-202: apply",
      developerTurns: 1n,
    });
    expect(await opened.repository.usage.findBySessionId("session-002")).toMatchObject({
      totalTokens: 6n,
    });
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      status: "ready",
      parserVersion: 2,
    });
    opened.database.close();
  });

  test("relocates a stable session instead of creating a duplicate", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const relocated = join(opened.root, "relocated.jsonl");
    await copyFile(opened.path, relocated);
    await opened.importer.importSource(opened.root, relocated);
    expect(await opened.repository.sessions.count()).toBe(1);
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      sourcePath: relocated,
      developerTurns: 1n,
    });
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject({
      totalTokens: 215n,
    });
    opened.database.close();
  });

  test("uses parser-version invalidation to incorporate newly supported records", async () => {
    const opened = await setup(1);
    await writeFile(
      opened.path,
      `${JSON.stringify({ type: "session_meta", payload: { id: "versioned" } })}\n${JSON.stringify({ type: "token_usage_v2", payload: { input_tokens: 7, cached_input_tokens: 2, output_tokens: 1 } })}\n`,
    );
    await opened.importer.importSource(opened.root, opened.path);
    expect((await opened.repository.usage.findBySessionId("versioned"))?.usageObserved).toBe(false);
    const upgraded = new CodexSourceImporter({
      repository: opened.repository,
      readChunkBytes: 128,
      logger,
      parserVersion: 2,
    });
    await upgraded.importSource(opened.root, opened.path);
    expect(await opened.repository.usage.findBySessionId("versioned")).toMatchObject({
      inputTokens: 7n,
      cachedInputTokens: 2n,
      outputTokens: 1n,
      totalTokens: 10n,
      usageObserved: true,
    });
    opened.database.close();
  });

  test("never persists synthetic private fixture markers", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const tables = [
      "codex_sessions",
      "codex_session_usage",
      "codex_import_checkpoints",
      "codex_import_runs",
    ];
    const serialized: string[] = [];
    for (const table of tables) {
      const reader = await opened.database.connection.runAndReadAll(`SELECT * FROM ${table}`);
      serialized.push(JSON.stringify(reader.getRowObjects(), jsonSafeReplacer));
    }
    const source = await readFile(fixture, "utf8");
    for (const marker of source.match(/SYNTHETIC_PRIVATE_[A-Z_]+/gu) ?? []) {
      expect(serialized.join("\n")).not.toContain(marker);
    }
    opened.database.close();
  });
});

function jsonSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
