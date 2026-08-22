import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { jsonSafeCount } from "@/database/models/codex-session-usage.model.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import type {
  SelectedSessionEvent,
  SourceChunkMutation,
  SourceParseState,
  UsageObservation,
} from "@/modules/sessions/domain.js";

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
  test("maps JSON-safe bigint summaries using input-inclusive-cached semantics", async () => {
    const opened = await repository();
    await opened.repository.sessions.upsert(
      { sessionId: "stable", sourceRoot: "/one", sourcePath: "/one/a.jsonl", title: "old" },
      3,
    );
    await opened.repository.usage.replaceTokens("stable", {
      input: 10n,
      cachedInput: 2n,
      output: 3n,
    });
    await opened.repository.sessions.upsert(
      { sessionId: "stable", sourceRoot: "/two", sourcePath: "/two/b.jsonl", title: "new" },
      3,
    );
    expect(await opened.repository.sessions.findById("stable")).toMatchObject({
      sourcePath: "/two/b.jsonl",
      currentTitle: "new",
    });
    expect(await opened.repository.usage.findBySessionId("stable")).toMatchObject({
      inputTokens: 10n,
      cachedInputTokens: 2n,
      uncachedInputTokens: 8n,
      outputTokens: 3n,
      totalTokens: 13n,
      usageObserved: true,
    });
    expect(jsonSafeCount(9_007_199_254_740_993n)).toBe("9007199254740993");
    opened.database.close();
  });

  test("updates only existing session titles without changing usage or attribution-owned data", async () => {
    const opened = await repository();
    await opened.repository.sessions.upsert(
      { sessionId: "indexed", sourceRoot: "/one", sourcePath: "/one/a.jsonl", title: "old" },
      3,
    );
    await opened.repository.usage.replaceTokens("indexed", {
      input: 10n,
      cachedInput: 2n,
      output: 3n,
    });
    const before = await opened.repository.sessions.findById("indexed");

    const changed = await opened.repository.reconcileSessionIndexTitles(
      new Map([
        ["indexed", "new"],
        ["orphan", "must not create"],
      ]),
    );

    expect(changed).toEqual(new Set(["indexed"]));
    expect(await opened.repository.sessions.findById("indexed")).toMatchObject({
      currentTitle: "new",
      sourcePath: before?.sourcePath,
      developerTurns: before?.developerTurns,
    });
    expect(await opened.repository.usage.findBySessionId("indexed")).toMatchObject({
      inputTokens: 10n,
      cachedInputTokens: 2n,
      outputTokens: 3n,
    });
    expect(await opened.repository.sessions.findById("orphan")).toBeUndefined();

    const cleared = await opened.repository.reconcileSessionIndexTitles(
      new Map([["indexed", null]]),
    );
    expect(cleared).toEqual(new Set(["indexed"]));
    expect((await opened.repository.sessions.findById("indexed"))?.currentTitle).toBeUndefined();
    opened.database.close();
  });

  test("atomically rolls back selected facts, parse state, summary, and checkpoint", async () => {
    const opened = await repository();
    const chunk = sourceChunk("rolled-back", "/root/failing.jsonl", [], []);
    const invalid: SourceChunkMutation = {
      ...chunk,
      mutations: [...chunk.mutations, {}],
    };
    expect(opened.repository.applySourceChunk(invalid)).rejects.toThrow(
      "missing a session identity",
    );
    expect(await opened.repository.sessions.findById("rolled-back")).toBeUndefined();
    expect(await opened.repository.parseStates.find("/root/failing.jsonl")).toBeUndefined();
    expect(await opened.repository.checkpoints.find("/root/failing.jsonl")).toBeUndefined();
    opened.database.close();
  });

  test("inserts source-owned facts idempotently and preserves raw malformed counters", async () => {
    const opened = await repository();
    const path = "/root/atomic.jsonl";
    const event = userEvent("atomic", path, 2n);
    const observation = usageObservation("atomic", path, 3n, {
      input: -1n,
      cachedInput: 0n,
      output: 4n,
    });
    const chunk = sourceChunk("atomic", path, [event], [observation]);
    await opened.repository.applySourceChunk(chunk);
    await opened.repository.applySourceChunk({ ...chunk, rebuild: false });

    expect(await opened.repository.events.listBySessionId("atomic")).toHaveLength(1);
    const storedObservations = await opened.repository.observations.listBySessionId("atomic");
    expect(storedObservations).toHaveLength(1);
    expect(storedObservations[0]).toMatchObject({
      sourcePath: path,
      rawLast: { input: -1n, cachedInput: 0n, output: 4n },
      normalized: {
        input: null,
        cachedInput: 0n,
        uncachedInput: null,
        output: 4n,
        total: null,
      },
    });
    expect(await opened.repository.sessions.findById("atomic")).toMatchObject({
      developerTurns: 1n,
    });
    expect(await opened.repository.usage.findBySessionId("atomic")).toMatchObject({
      inputTokens: null,
      cachedInputTokens: 0n,
      outputTokens: 4n,
      totalTokens: null,
      usageObserved: true,
      anomalyCodes: ["negative_counter"],
    });
    expect(await opened.repository.checkpoints.find(path)).toMatchObject({ committedOffset: 99n });
    opened.database.close();
  });

  test("recomputes one session across multiple source-owned contributions", async () => {
    const opened = await repository();
    const firstPath = "/root/one.jsonl";
    const secondPath = "/root/two.jsonl";
    await opened.repository.applySourceChunk(
      sourceChunk(
        "shared",
        firstPath,
        [userEvent("shared", firstPath, 2n)],
        [usageObservation("shared", firstPath, 3n, { input: 5n, cachedInput: 1n, output: 2n })],
      ),
    );
    await opened.repository.applySourceChunk(
      sourceChunk(
        "shared",
        secondPath,
        [userEvent("shared", secondPath, 2n)],
        [usageObservation("shared", secondPath, 3n, { input: 7n, cachedInput: 2n, output: 3n })],
      ),
    );
    expect(await opened.repository.sessions.findById("shared")).toMatchObject({
      developerTurns: 2n,
    });
    expect(await opened.repository.usage.findBySessionId("shared")).toMatchObject({
      inputTokens: 12n,
      cachedInputTokens: 3n,
      uncachedInputTokens: 9n,
      outputTokens: 5n,
      totalTokens: 17n,
    });
    opened.database.close();
  });
});

function sourceChunk(
  sessionId: string,
  sourcePath: string,
  events: readonly SelectedSessionEvent[],
  observations: readonly UsageObservation[],
): SourceChunkMutation {
  return {
    sourcePath,
    sourceRoot: "/root",
    sourceIdentity: `identity:${sourcePath}`,
    committedOffset: 99n,
    observedSize: 100n,
    observedModifiedAtMs: 10n,
    parserVersion: 3,
    mutations: [{ metadata: { sessionId, sourceRoot: "/root", sourcePath } }],
    events,
    observations,
    parseState: parseState(sessionId, sourcePath),
    diagnostics: { unknownRecords: 0, malformedRecords: 0, warnings: [] },
    rebuild: true,
  };
}

function parseState(sessionId: string, sourcePath: string): SourceParseState {
  return {
    sourcePath,
    sessionId,
    sourceIdentity: `identity:${sourcePath}`,
    parserVersion: 3,
    activeModel: "unknown",
    epoch: 0,
    baseline: null,
    nextRecordNumber: 4n,
    factRevision: 1n,
  };
}

function userEvent(sessionId: string, sourcePath: string, record: bigint): SelectedSessionEvent {
  return {
    eventId: `${sourcePath}:${record}:user_message`,
    sessionId,
    sourcePath,
    sourceIdentity: `identity:${sourcePath}`,
    sourceRecordNumber: record,
    kind: "user_message",
    messageRole: "user",
    eventTime: null,
    messageContent: "selected message",
    parserVersion: 3,
  };
}

function usageObservation(
  sessionId: string,
  sourcePath: string,
  record: bigint,
  raw: { input: bigint; cachedInput: bigint; output: bigint },
): UsageObservation {
  const input = raw.input < 0n ? null : raw.input;
  let cached = raw.cachedInput < 0n ? null : raw.cachedInput;
  if (input !== null && cached !== null && cached > input) cached = null;
  const output = raw.output < 0n ? null : raw.output;
  return {
    observationId: `${sourcePath}:${record}:usage`,
    sessionId,
    sourcePath,
    sourceIdentity: `identity:${sourcePath}`,
    sourceRecordNumber: record,
    parserVersion: 3,
    model: "unknown",
    eventTime: null,
    rawCumulative: null,
    rawLast: raw,
    normalized: {
      input,
      cachedInput: cached,
      uncachedInput: input !== null && cached !== null ? input - cached : null,
      output,
      total: input !== null && output !== null ? input + output : null,
    },
    epoch: 0,
    method: "standalone_delta",
    complete: input !== null && cached !== null && output !== null,
    anomalyCodes: raw.input < 0n ? ["negative_counter"] : [],
    legacy: false,
  };
}
