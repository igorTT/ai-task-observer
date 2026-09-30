import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations, loadMigrations } from "@/database/migrate.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { CodexUsageObservationRepository } from "@/database/repositories/codex-usage-observation-repository.js";
import { discoverRoot } from "@/modules/sessions/discovery.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";
import { CostCalculationService } from "@/modules/pricing/calculation-service.js";
import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import { CODEX_PARSER_VERSION, parseCodexRecords } from "@/modules/sessions/parser.js";
import { inspectSource } from "@/modules/sessions/source-reader.js";
import type { SourceParseState } from "@/modules/sessions/domain.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const itemCompletedFixture = fileURLToPath(
  new URL("../../fixtures/codex/item-completed-user-turns.jsonl", import.meta.url),
);
const pricingFixture = fileURLToPath(
  new URL("../../fixtures/pricing/valid-catalog.json", import.meta.url),
);
const directories: string[] = [];
const logger = pino({ enabled: false });

async function setup(
  parserVersion = CODEX_PARSER_VERSION,
  sourceFixture = fixture,
): Promise<{
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
  await copyFile(sourceFixture, path);
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
      uncachedInputTokens: 125n,
      totalTokens: 190n,
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
      totalTokens: 250n,
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

  test("resumes model and cumulative state from the committed checkpoint after restart", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const checkpoint = await opened.repository.checkpoints.find(opened.path);
    const previousObservations =
      await opened.repository.observations.listBySessionId("session-001");
    opened.database.close();
    await appendFile(
      opened.path,
      `${JSON.stringify({
        timestamp: "2026-01-02T03:11:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 200,
              cached_input_tokens: 30,
              output_tokens: 50,
            },
            last_token_usage: {
              input_tokens: 50,
              cached_input_tokens: 5,
              output_tokens: 10,
            },
          },
        },
      })}\n`,
    );
    const database = await AppDatabase.open(join(dirname(opened.root), "test.duckdb"));
    const repository = new CodexIngestionRepository(database);
    const importer = new CodexSourceImporter({ repository, readChunkBytes: 128, logger });
    await importer.importSource(opened.root, opened.path);
    const resumedCheckpoint = await repository.checkpoints.find(opened.path);
    expect(resumedCheckpoint).toMatchObject({
      parserVersion: CODEX_PARSER_VERSION,
      sessionId: "session-001",
      activeModel: "synthetic-model",
      epoch: 0,
      baseline: { input: 200n, cachedInput: 30n, output: 50n },
    });
    expect(resumedCheckpoint?.committedOffset).toBeGreaterThan(checkpoint?.committedOffset ?? 0n);
    expect(resumedCheckpoint?.nextRecordNumber).toBe((checkpoint?.nextRecordNumber ?? 0n) + 1n);
    const resumedObservations = await repository.observations.listBySessionId("session-001");
    expect(resumedObservations).toHaveLength(previousObservations.length + 1);
    expect(resumedObservations.slice(0, previousObservations.length)).toEqual(previousObservations);
    expect((await repository.observations.listBySessionId("session-001")).at(-1)).toMatchObject({
      model: "synthetic-model",
      normalized: { input: 50n, cachedInput: 5n, output: 10n, total: 60n },
    });
    expect(await repository.usage.findBySessionId("session-001")).toMatchObject({
      totalTokens: 250n,
    });
    database.close();
  });

  test("preserves migrated observation and cost revisions and matches uninterrupted appends", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-checkpoint-migration-parity-"));
    directories.push(directory);
    const path = join(directory, "parity.jsonl");
    const prefixRecords = [
      JSON.stringify({ type: "session_meta", payload: { id: "parity-session" } }),
      JSON.stringify({ type: "turn_context", payload: { model: "model-a-alias" } }),
      JSON.stringify({
        type: "event_msg",
        payload: { type: "user_message", message: "SYNTHETIC_PREFIX_USER" },
      }),
      JSON.stringify({
        timestamp: "2026-01-15T00:00:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 },
            last_token_usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 },
          },
        },
      }),
    ];
    const prefix = `${prefixRecords.join("\n")}\n`;
    await writeFile(path, prefix);

    const uninterruptedDatabase = await AppDatabase.open(join(directory, "uninterrupted.duckdb"));
    await applyMigrations(uninterruptedDatabase, logger);
    const uninterruptedRepository = new CodexIngestionRepository(uninterruptedDatabase);
    const uninterruptedImporter = new CodexSourceImporter({
      repository: uninterruptedRepository,
      readChunkBytes: 4096,
      logger,
    });
    await uninterruptedImporter.importSource(directory, path);

    const migratedDatabase = await AppDatabase.open(join(directory, "migrated.duckdb"));
    const migrations = await loadMigrations();
    await applyMigrations(migratedDatabase, logger, migrations.slice(0, 2));
    const legacyState = await seedLegacyPrefix(migratedDatabase, directory, path, prefixRecords);

    const catalog = await loadPricingCatalog(pricingFixture);
    const uninterruptedPrefixCost = await new CostCalculationService({
      database: uninterruptedDatabase,
      catalog,
      createId: () => "prefix-cost",
    }).calculate();
    const migratedPrefixCost = await new CostCalculationService({
      database: migratedDatabase,
      catalog,
      createId: () => "prefix-cost",
    }).calculate();
    expect(migratedPrefixCost.sourceFactRevision).toBe(uninterruptedPrefixCost.sourceFactRevision);
    const migratedObservationsBefore = await new CodexUsageObservationRepository(
      migratedDatabase.connection,
    ).stableSnapshot();
    const migratedCostItemsBefore = await new CostCalculationRepository(
      migratedDatabase.connection,
    ).listItems("prefix-cost");

    await applyMigrations(migratedDatabase, logger);

    const migratedObservationsAfter = await new CodexUsageObservationRepository(
      migratedDatabase.connection,
    ).stableSnapshot();
    const migratedCostRepository = new CostCalculationRepository(migratedDatabase.connection);
    expect(migratedObservationsAfter).toEqual(migratedObservationsBefore);
    expect(await migratedCostRepository.find("prefix-cost")).toEqual(migratedPrefixCost);
    expect(await migratedCostRepository.listItems("prefix-cost")).toEqual(migratedCostItemsBefore);

    const completeSuffix =
      [
        JSON.stringify({ type: "turn_context", payload: { model: "model-b-alias" } }),
        JSON.stringify({
          type: "event_msg",
          payload: { type: "user_message", message: "SYNTHETIC_SUFFIX_USER" },
        }),
        JSON.stringify({
          timestamp: "2026-01-15T00:01:00.000Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: { input_tokens: 20, cached_input_tokens: 5, output_tokens: 10 },
              last_token_usage: { input_tokens: 20, cached_input_tokens: 5, output_tokens: 10 },
            },
          },
        }),
        "not-json",
        JSON.stringify({ type: "future_record", payload: {} }),
        JSON.stringify({
          timestamp: "2026-01-15T00:02:00.000Z",
          type: "token_usage",
          payload: {
            cumulative: true,
            input_tokens: 35,
            cached_input_tokens: 8,
            output_tokens: 19,
          },
        }),
      ].join("\n") + "\n";
    const trailingRecord = JSON.stringify({
      timestamp: "2026-01-15T00:03:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: { input_tokens: 40, cached_input_tokens: 9, output_tokens: 24 },
          last_token_usage: { input_tokens: 4, cached_input_tokens: 1, output_tokens: 5 },
        },
      },
    });
    await appendFile(path, completeSuffix + trailingRecord.slice(0, -1));
    await uninterruptedImporter.importSource(directory, path);
    const migratedImporter = new CodexSourceImporter({
      repository: new CodexIngestionRepository(migratedDatabase),
      readChunkBytes: 4096,
      logger,
    });
    await migratedImporter.importSource(directory, path);

    const afterCompleteSuffix = await migratedImporter.importSource(directory, path);
    expect(afterCompleteSuffix.state).toBe("imported");
    const heldCheckpoint = await new CodexIngestionRepository(migratedDatabase).checkpoints.find(
      path,
    );
    expect(heldCheckpoint?.nextRecordNumber).toBe(legacyState.nextRecordNumber + 6n);
    expect(heldCheckpoint?.malformedRecords).toBe(1);
    expect(heldCheckpoint?.unknownRecords).toBe(1);

    await appendFile(path, "}\n");
    await uninterruptedImporter.importSource(directory, path);
    await migratedImporter.importSource(directory, path);

    const finalUninterruptedRepository = new CodexIngestionRepository(uninterruptedDatabase);
    const finalMigratedRepository = new CodexIngestionRepository(migratedDatabase);
    const uninterruptedObservations =
      await finalUninterruptedRepository.observations.listBySessionId("parity-session");
    const migratedObservations =
      await finalMigratedRepository.observations.listBySessionId("parity-session");
    expect(migratedObservations).toEqual(uninterruptedObservations);
    expect(migratedObservations.map((observation) => observation.observationId)).toEqual([
      `${path}:4:usage`,
      `${path}:7:usage`,
      `${path}:10:usage`,
      `${path}:11:usage`,
    ]);
    expect(migratedObservations.map((observation) => observation.epoch)).toEqual([0, 1, 1, 1]);
    expect(migratedObservations.map((observation) => observation.anomalyCodes)).toEqual([
      [],
      ["counter_reset"],
      [],
      ["last_usage_mismatch"],
    ]);
    expect(await finalMigratedRepository.events.listBySessionId("parity-session")).toEqual(
      await finalUninterruptedRepository.events.listBySessionId("parity-session"),
    );
    expect(await finalMigratedRepository.sessions.findById("parity-session")).toMatchObject({
      developerTurns: 2n,
    });
    const migratedUsage = await finalMigratedRepository.usage.findBySessionId("parity-session");
    const uninterruptedUsage =
      await finalUninterruptedRepository.usage.findBySessionId("parity-session");
    expect(migratedUsage).toMatchObject({
      inputTokens: uninterruptedUsage?.inputTokens,
      cachedInputTokens: uninterruptedUsage?.cachedInputTokens,
      uncachedInputTokens: uninterruptedUsage?.uncachedInputTokens,
      outputTokens: uninterruptedUsage?.outputTokens,
      totalTokens: uninterruptedUsage?.totalTokens,
      usageObserved: uninterruptedUsage?.usageObserved,
      completeness: uninterruptedUsage?.completeness,
      anomalyCodes: uninterruptedUsage?.anomalyCodes,
      factRevision: uninterruptedUsage?.factRevision,
    });
    expect(await finalMigratedRepository.checkpoints.find(path)).toMatchObject({
      activeModel: "model-b-alias",
      epoch: 1,
      baseline: { input: 40n, cachedInput: 9n, output: 24n },
      nextRecordNumber: 12n,
      malformedRecords: 1,
      unknownRecords: 1,
    });

    const uninterruptedFinalCost = await new CostCalculationService({
      database: uninterruptedDatabase,
      catalog,
      createId: () => "final-cost",
    }).calculate();
    const migratedFinalCost = await new CostCalculationService({
      database: migratedDatabase,
      catalog,
      createId: () => "final-cost",
    }).calculate();
    expect(migratedFinalCost.sourceFactRevision).toBe(uninterruptedFinalCost.sourceFactRevision);
    expect(
      await new CostCalculationRepository(migratedDatabase.connection).listItems("final-cost"),
    ).toEqual(
      await new CostCalculationRepository(uninterruptedDatabase.connection).listItems("final-cost"),
    );

    uninterruptedDatabase.close();
    migratedDatabase.close();
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
      totalTokens: null,
      usageObserved: false,
    });
    const previousCheckpoint = await opened.repository.checkpoints.find(opened.path);
    const previousObservations =
      await opened.repository.observations.listBySessionId("session-001");

    const replacement = join(opened.root, "replacement.jsonl");
    await writeFile(replacement, `${JSON.stringify({ type: "turn_context", payload: {} })}\n`);
    await rename(replacement, opened.path);
    const replacementFailure = await captureError(
      opened.importer.importSource(opened.root, opened.path),
    );
    expect(replacementFailure).toBeInstanceOf(Error);
    expect((replacementFailure as Error).message).toContain("stable session identity");
    expect(await opened.repository.sessions.findById("session-001")).toMatchObject({
      currentTitle: "rebuilt",
      importState: "stale",
    });
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      status: "stale",
      committedOffset: previousCheckpoint?.committedOffset,
      sessionId: previousCheckpoint?.sessionId,
      activeModel: previousCheckpoint?.activeModel,
      epoch: previousCheckpoint?.epoch,
      baseline: previousCheckpoint?.baseline,
      nextRecordNumber: previousCheckpoint?.nextRecordNumber,
    });
    expect(await opened.repository.observations.listBySessionId("session-001")).toEqual(
      previousObservations,
    );
    opened.database.close();
  });

  test("rolls back partial append and rebuild failures and retries from the committed checkpoint", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);

    const beforeAppendCheckpoint = await opened.repository.checkpoints.find(opened.path);
    const beforeAppendEvents = await opened.repository.events.listBySessionId("session-001");
    const beforeAppendObservations =
      await opened.repository.observations.listBySessionId("session-001");
    const beforeAppendUsage = await opened.repository.usage.findBySessionId("session-001");
    const wideImporter = new CodexSourceImporter({
      repository: opened.repository,
      readChunkBytes: 4096,
      logger,
    });
    await appendFile(
      opened.path,
      `${JSON.stringify({
        type: "event_msg",
        payload: { type: "user_message", message: "SYNTHETIC_APPEND_ONE" },
      })}\n${JSON.stringify({
        type: "event_msg",
        payload: { type: "agent_message", message: "SYNTHETIC_APPEND_TWO" },
      })}\n`,
    );
    const restoreAppendInsert = failSecondEventInsertOnce(opened.repository);
    const appendFailure = await captureError(wideImporter.importSource(opened.root, opened.path));
    expect(appendFailure).toBeInstanceOf(Error);
    expect((appendFailure as Error).message).toContain("injected event insert failure");
    restoreAppendInsert();
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      committedOffset: beforeAppendCheckpoint?.committedOffset,
      sessionId: beforeAppendCheckpoint?.sessionId,
      activeModel: beforeAppendCheckpoint?.activeModel,
      baseline: beforeAppendCheckpoint?.baseline,
      epoch: beforeAppendCheckpoint?.epoch,
      nextRecordNumber: beforeAppendCheckpoint?.nextRecordNumber,
      status: "ready",
    });
    expect(await opened.repository.events.listBySessionId("session-001")).toEqual(
      beforeAppendEvents,
    );
    expect(await opened.repository.observations.listBySessionId("session-001")).toEqual(
      beforeAppendObservations,
    );
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject(
      beforeAppendUsage!,
    );

    await wideImporter.importSource(opened.root, opened.path);
    const afterAppendEvents = await opened.repository.events.listBySessionId("session-001");
    expect(afterAppendEvents).toHaveLength(beforeAppendEvents.length + 2);
    expect(afterAppendEvents.map((event) => event.messageContent)).toContain(
      "SYNTHETIC_APPEND_ONE",
    );
    expect(afterAppendEvents.map((event) => event.messageContent)).toContain(
      "SYNTHETIC_APPEND_TWO",
    );

    const beforeRebuildCheckpoint = await opened.repository.checkpoints.find(opened.path);
    const beforeRebuildEvents = await opened.repository.events.listBySessionId("session-001");
    const beforeRebuildObservations =
      await opened.repository.observations.listBySessionId("session-001");
    const beforeRebuildUsage = await opened.repository.usage.findBySessionId("session-001");
    const replacement = join(opened.root, "replacement.jsonl");
    await writeFile(
      replacement,
      [
        JSON.stringify({ type: "session_meta", payload: { id: "session-001", title: "rebuilt" } }),
        JSON.stringify({
          type: "event_msg",
          payload: { type: "user_message", message: "SYNTHETIC_REBUILD_ONE" },
        }),
        JSON.stringify({
          type: "event_msg",
          payload: { type: "agent_message", message: "SYNTHETIC_REBUILD_TWO" },
        }),
      ].join("\n") + "\n",
    );
    await rename(replacement, opened.path);
    const restoreRebuildInsert = failSecondEventInsertOnce(opened.repository);
    const rebuildFailure = await captureError(
      opened.importer.importSource(opened.root, opened.path),
    );
    expect(rebuildFailure).toBeInstanceOf(Error);
    expect((rebuildFailure as Error).message).toContain("injected event insert failure");
    restoreRebuildInsert();
    const staleCheckpoint = await opened.repository.checkpoints.find(opened.path);
    expect(staleCheckpoint).toMatchObject({
      committedOffset: beforeRebuildCheckpoint?.committedOffset,
      sessionId: beforeRebuildCheckpoint?.sessionId,
      activeModel: beforeRebuildCheckpoint?.activeModel,
      baseline: beforeRebuildCheckpoint?.baseline,
      epoch: beforeRebuildCheckpoint?.epoch,
      nextRecordNumber: beforeRebuildCheckpoint?.nextRecordNumber,
      status: "stale",
    });
    expect(staleCheckpoint?.lastError).toBeDefined();
    expect(staleCheckpoint?.lastError).not.toContain("injected event insert failure");
    expect(await opened.repository.events.listBySessionId("session-001")).toEqual(
      beforeRebuildEvents,
    );
    expect(await opened.repository.observations.listBySessionId("session-001")).toEqual(
      beforeRebuildObservations,
    );
    expect(await opened.repository.usage.findBySessionId("session-001")).toMatchObject(
      beforeRebuildUsage!,
    );

    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      status: "ready",
      sessionId: "session-001",
    });
    expect((await opened.repository.checkpoints.find(opened.path))?.lastError).toBeUndefined();
    expect(await opened.repository.events.listBySessionId("session-001")).toHaveLength(2);
    expect(
      (await opened.repository.events.listBySessionId("session-001")).map(
        (event) => event.messageContent,
      ),
    ).toEqual(["SYNTHETIC_REBUILD_ONE", "SYNTHETIC_REBUILD_TWO"]);
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
      totalTokens: 5n,
    });
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      status: "ready",
      parserVersion: CODEX_PARSER_VERSION,
    });
    const eventsBeforeAppend = await opened.repository.events.listBySessionId("session-002");
    await appendFile(
      opened.path,
      `${JSON.stringify({
        type: "event_msg",
        payload: { type: "user_message", message: "SYNTHETIC_REPLACEMENT_APPEND" },
      })}\n`,
    );
    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.events.listBySessionId("session-002")).toHaveLength(
      eventsBeforeAppend.length + 1,
    );
    expect(await opened.repository.checkpoints.list()).toHaveLength(1);
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
      totalTokens: 190n,
    });
    const eventsBeforeAppend = await opened.repository.events.listBySessionId("session-001");
    const checkpointsBeforeAppend = await opened.repository.checkpoints.list();
    expect(checkpointsBeforeAppend.map((checkpoint) => checkpoint.sourcePath)).toEqual([relocated]);
    await appendFile(
      relocated,
      `${JSON.stringify({
        type: "event_msg",
        payload: { type: "user_message", message: "SYNTHETIC_RELOCATION_APPEND" },
      })}\n`,
    );
    await opened.importer.importSource(opened.root, relocated);
    expect(await opened.repository.events.listBySessionId("session-001")).toHaveLength(
      eventsBeforeAppend.length + 1,
    );
    expect(
      (await opened.repository.checkpoints.list()).map((checkpoint) => checkpoint.sourcePath),
    ).toEqual([relocated]);
    expect((await opened.importer.importSource(opened.root, relocated)).state).toBe("unchanged");
    expect(await opened.repository.events.listBySessionId("session-001")).toHaveLength(
      eventsBeforeAppend.length + 1,
    );
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
      totalTokens: 8n,
      usageObserved: true,
    });
    opened.database.close();
  });

  test("rebuilds version-3 sources with current user items and stays idempotent", async () => {
    const opened = await setup(3, itemCompletedFixture);
    await opened.importer.importSource(opened.root, opened.path);
    expect(await opened.repository.sessions.findById("item-completed-user-turns")).toMatchObject({
      developerTurns: 1n,
    });
    expect(
      await opened.repository.events.listBySessionId("item-completed-user-turns"),
    ).toHaveLength(1);
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      parserVersion: 3,
    });

    const upgraded = new CodexSourceImporter({
      repository: opened.repository,
      readChunkBytes: 128,
      logger,
      parserVersion: CODEX_PARSER_VERSION,
    });
    const rebuilt = await upgraded.importSource(opened.root, opened.path);
    expect(rebuilt).toMatchObject({
      state: "imported",
      rebuilt: true,
      sessions: ["item-completed-user-turns"],
    });
    expect(await opened.repository.sessions.findById("item-completed-user-turns")).toMatchObject({
      developerTurns: 2n,
    });
    expect(await opened.repository.checkpoints.find(opened.path)).toMatchObject({
      parserVersion: CODEX_PARSER_VERSION,
      status: "ready",
    });
    const rebuiltEvents = await opened.repository.events.listBySessionId(
      "item-completed-user-turns",
    );
    expect(rebuiltEvents).toHaveLength(2);
    expect(rebuiltEvents.map((event) => event.sourceRecordNumber)).toEqual([2n, 3n]);
    expect(rebuiltEvents.map((event) => event.messageContent)).toEqual([
      "SYNTHETIC_LEGACY_USER",
      "SYNTHETIC_CURRENT_USER",
    ]);

    await appendFile(
      opened.path,
      `${JSON.stringify({
        type: "event_msg",
        payload: {
          type: "item_completed",
          item: {
            id: "synthetic-appended-user-item",
            type: "UserMessage",
            content: [{ type: "text", text: "SYNTHETIC_APPENDED_CURRENT_USER" }],
          },
        },
      })}\n`,
    );
    const appended = await upgraded.importSource(opened.root, opened.path);
    expect(appended).toMatchObject({ state: "imported", rebuilt: false });
    expect(await opened.repository.sessions.findById("item-completed-user-turns")).toMatchObject({
      developerTurns: 3n,
    });
    expect(
      await opened.repository.events.listBySessionId("item-completed-user-turns"),
    ).toHaveLength(3);
    expect((await upgraded.importSource(opened.root, opened.path)).state).toBe("unchanged");
    expect(
      (await opened.repository.sessions.findById("item-completed-user-turns"))?.developerTurns,
    ).toBe(3n);
    opened.database.close();
  });

  test("persists selected messages but never excluded fixture payloads", async () => {
    const opened = await setup();
    await opened.importer.importSource(opened.root, opened.path);
    const tables = [
      "codex_sessions",
      "codex_session_usage",
      "codex_import_checkpoints",
      "codex_import_runs",
      "codex_session_events",
      "codex_usage_observations",
    ];
    const serialized: string[] = [];
    for (const table of tables) {
      const reader = await opened.database.connection.runAndReadAll(`SELECT * FROM ${table}`);
      serialized.push(JSON.stringify(reader.getRowObjects(), jsonSafeReplacer));
    }
    expect(serialized.join("\n")).toContain("SYNTHETIC_PRIVATE_PROMPT");
    expect(serialized.join("\n")).toContain("SYNTHETIC_PRIVATE_RESPONSE");
    for (const marker of [
      "SYNTHETIC_PRIVATE_DEVELOPER",
      "SYNTHETIC_PRIVATE_TOOL_ARGUMENT",
      "SYNTHETIC_PRIVATE_TOOL_RESULT",
      "SYNTHETIC_PRIVATE_UNKNOWN",
    ]) {
      expect(serialized.join("\n")).not.toContain(marker);
    }
    opened.database.close();
  });
});

function jsonSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

function failSecondEventInsertOnce(repository: CodexIngestionRepository): () => void {
  const insert = repository.events.insert.bind(repository.events);
  let attempts = 0;
  repository.events.insert = async (event) => {
    attempts += 1;
    if (attempts === 2) {
      repository.events.insert = insert;
      throw new Error("injected event insert failure");
    }
    await insert(event);
  };
  return () => {
    repository.events.insert = insert;
  };
}

async function seedLegacyPrefix(
  database: AppDatabase,
  sourceRoot: string,
  sourcePath: string,
  records: readonly string[],
): Promise<SourceParseState> {
  const source = await inspectSource(sourcePath);
  const parsed = parseCodexRecords(records, {
    sourceRoot,
    sourcePath,
    sourceIdentity: source.key,
    parserVersion: CODEX_PARSER_VERSION,
  });
  const sessionId = parsed.sessionId;
  const state = parsed.parseState;
  if (!sessionId || !state) throw new Error("Legacy prefix fixture did not produce a session");

  const repository = new CodexIngestionRepository(database);
  for (const mutation of parsed.mutations) {
    const identity = mutation.metadata?.sessionId ?? mutation.sessionId;
    if (!identity) throw new Error("Legacy prefix fixture mutation is missing a session identity");
    if (mutation.metadata) {
      await repository.sessions.upsert(mutation.metadata, CODEX_PARSER_VERSION, "ready");
      await repository.usage.ensure(identity);
    }
  }
  for (const event of parsed.events) await repository.events.insert(event);
  for (const observation of parsed.observations) {
    await repository.observations.insert(observation);
  }
  await repository.usage.recompute(
    sessionId,
    parsed.observations,
    BigInt(parsed.events.filter((event) => event.kind === "user_message").length),
    1n,
  );

  const checkpoint = await database.connection.prepare(`
    INSERT INTO codex_import_checkpoints (
      source_path, source_root, source_identity, committed_offset, observed_size,
      observed_modified_at_ms, parser_version, status, unknown_records, malformed_records
    ) VALUES (
      $path, $root, $identity, $offset, $size, $modifiedAt, $version, 'ready', $unknown, $malformed
    )
  `);
  checkpoint.bind({
    path: sourcePath,
    root: sourceRoot,
    identity: source.key,
    offset: BigInt(Buffer.byteLength(`${records.join("\n")}\n`)),
    size: source.size,
    modifiedAt: source.modifiedAtMs,
    version: CODEX_PARSER_VERSION,
    unknown: parsed.diagnostics.unknownRecords,
    malformed: parsed.diagnostics.malformedRecords,
  });
  await checkpoint.run();

  const continuation = await database.connection.prepare(`
    INSERT INTO codex_source_parse_state (
      source_path, session_id, source_identity, parser_version, active_model,
      normalization_epoch, baseline_input, baseline_cached_input, baseline_output,
      next_record_number, fact_revision
    ) VALUES (
      $path, $sessionId, $identity, $version, $activeModel, $epoch,
      $baselineInput, $baselineCachedInput, $baselineOutput, $nextRecordNumber, 777
    )
  `);
  continuation.bind({
    path: sourcePath,
    sessionId,
    identity: source.key,
    version: CODEX_PARSER_VERSION,
    activeModel: state.activeModel,
    epoch: state.epoch,
    baselineInput: state.baseline?.input ?? null,
    baselineCachedInput: state.baseline?.cachedInput ?? null,
    baselineOutput: state.baseline?.output ?? null,
    nextRecordNumber: state.nextRecordNumber,
  });
  await continuation.run();
  return state;
}
