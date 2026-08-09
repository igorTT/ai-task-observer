import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { jsonSafeCount } from "@/database/models/codex-session-usage.model.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { tokenValues, type SourceChunkMutation } from "@/modules/sessions/domain.js";

const directories: string[] = [];
const logger = pino({ enabled: false });

async function repository(): Promise<{
  database: AppDatabase;
  repository: CodexIngestionRepository;
}> {
  const directory = await mkdtemp(join(tmpdir(), "codex-repository-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  await applyMigrations(database, logger);
  return { database, repository: new CodexIngestionRepository(database) };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Codex ingestion repositories", () => {
  test("upserts stable identity, relocates provenance, and keeps token totals consistent", async () => {
    const opened = await repository();
    await opened.repository.sessions.upsert(
      { sessionId: "stable", sourceRoot: "/one", sourcePath: "/one/a.jsonl", title: "old" },
      2,
    );
    await opened.repository.usage.replaceTokens("stable", tokenValues(10n, 2n, 3n));
    await opened.repository.usage.addTokens("stable", tokenValues(1n, 1n, 1n));
    await opened.repository.usage.addDeveloperTurns("stable", 2n);
    await opened.repository.sessions.upsert(
      { sessionId: "stable", sourceRoot: "/two", sourcePath: "/two/b.jsonl", title: "new" },
      2,
    );

    expect(await opened.repository.sessions.count()).toBe(1);
    expect(await opened.repository.sessions.findById("stable")).toMatchObject({
      sourcePath: "/two/b.jsonl",
      currentTitle: "new",
      developerTurns: 2n,
    });
    const usage = await opened.repository.usage.findBySessionId("stable");
    expect(usage).toMatchObject({
      inputTokens: 11n,
      cachedInputTokens: 3n,
      outputTokens: 4n,
      totalTokens: 18n,
      usageObserved: true,
    });
    expect(jsonSafeCount(9_007_199_254_740_993n)).toBe("9007199254740993");
    expect(() => tokenValues(-1n, 0n, 0n)).toThrow(RangeError);
    opened.database.close();
  });

  test("lists deterministically and atomically rolls back session and checkpoint changes", async () => {
    const opened = await repository();
    for (const id of ["b", "a", "c"]) {
      await opened.repository.sessions.upsert(
        { sessionId: id, sourceRoot: "/root", sourcePath: `/root/${id}.jsonl` },
        2,
      );
    }
    expect((await opened.repository.sessions.list(2, 0)).map((row) => row.sessionId)).toEqual([
      "a",
      "b",
    ]);

    const chunk: SourceChunkMutation = {
      sourcePath: "/root/failing.jsonl",
      sourceRoot: "/root",
      sourceIdentity: "1:1",
      committedOffset: 10n,
      observedSize: 10n,
      observedModifiedAtMs: 1n,
      parserVersion: 2,
      mutations: [
        {
          metadata: {
            sessionId: "rolled-back",
            sourceRoot: "/root",
            sourcePath: "/root/failing.jsonl",
          },
        },
        {},
      ],
      diagnostics: { unknownRecords: 0, malformedRecords: 0, warnings: [] },
      rebuild: false,
    };
    expect(opened.repository.applySourceChunk(chunk)).rejects.toThrow("missing a session identity");
    expect(await opened.repository.sessions.findById("rolled-back")).toBeUndefined();
    expect(await opened.repository.checkpoints.find("/root/failing.jsonl")).toBeUndefined();
    opened.database.close();
  });

  test("commits derived facts and checkpoint together", async () => {
    const opened = await repository();
    await opened.repository.applySourceChunk({
      sourcePath: "/root/atomic.jsonl",
      sourceRoot: "/root",
      sourceIdentity: "1:2",
      committedOffset: 99n,
      observedSize: 100n,
      observedModifiedAtMs: 10n,
      parserVersion: 2,
      mutations: [
        {
          metadata: {
            sessionId: "atomic",
            sourceRoot: "/root",
            sourcePath: "/root/atomic.jsonl",
          },
          developerTurnDelta: 1n,
          tokenSnapshot: tokenValues(1n, 2n, 3n),
        },
      ],
      diagnostics: { unknownRecords: 1, malformedRecords: 2, warnings: [] },
      rebuild: true,
    });
    expect(await opened.repository.sessions.findById("atomic")).toBeDefined();
    expect(await opened.repository.checkpoints.find("/root/atomic.jsonl")).toMatchObject({
      committedOffset: 99n,
      unknownRecords: 1,
      malformedRecords: 2,
    });
    opened.database.close();
  });
});
