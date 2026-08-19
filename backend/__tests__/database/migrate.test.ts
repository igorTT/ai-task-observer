import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import {
  applyMigrations,
  loadMigrations,
  MigrationError,
  type Migration,
} from "@/database/migrate.js";
import { MigrationRepository } from "@/database/repositories/migration-repository.js";

const logger = pino({ enabled: false });
const temporaryDirectories: string[] = [];

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

async function temporaryDatabase(): Promise<{ database: AppDatabase; path: string }> {
  const directory = await mkdtemp(join(tmpdir(), "ai-task-observer-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "test.duckdb");
  return { database: await AppDatabase.open(path), path };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("migration runner", () => {
  test("creates a new database and records the foundation migration", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);
    const records = await new MigrationRepository(database.connection).findAll();
    expect(records).toHaveLength(5);
    expect(records[0]?.name).toBe("foundation");
    database.close();
  });

  test("reopens a current database without duplicating effects", async () => {
    const opened = await temporaryDatabase();
    await applyMigrations(opened.database, logger);
    opened.database.close();

    const reopened = await AppDatabase.open(opened.path);
    await applyMigrations(reopened, logger);
    const records = await new MigrationRepository(reopened.connection).findAll();
    expect(records).toHaveLength(5);
    reopened.close();
  });

  test("upgrades the existing ingestion schema with attribution tables", async () => {
    const { database } = await temporaryDatabase();
    const migrations = await loadMigrations();
    await applyMigrations(database, logger, migrations.slice(0, 2));
    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, current_title, import_state, parser_version
      ) VALUES ('existing', '/root', '/root/existing.jsonl', 'ENG-1', 'ready', 2)
    `);
    await applyMigrations(database, logger, migrations);
    const tables = await database.connection.runAndReadAll(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('linear_issues', 'linear_session_attributions', 'linear_sync_runs')
      ORDER BY table_name
    `);
    expect(tables.getRowObjects().map((row) => row.table_name)).toEqual([
      "linear_issues",
      "linear_session_attributions",
      "linear_sync_runs",
    ]);
    const sessions = await database.connection.runAndReadAll(
      "SELECT session_id FROM codex_sessions WHERE session_id = 'existing'",
    );
    expect(sessions.getRowObjects()).toHaveLength(1);
    database.close();
  });

  test("migrates legacy aggregates into explicitly incomplete observations", async () => {
    const { database } = await temporaryDatabase();
    const migrations = await loadMigrations();
    await applyMigrations(database, logger, migrations.slice(0, 3));
    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, import_state, parser_version
      ) VALUES ('legacy', '/root', '/root/legacy.jsonl', 'ready', 2);
      INSERT INTO codex_session_usage (
        session_id, input_tokens, cached_input_tokens, output_tokens, total_tokens, usage_observed
      ) VALUES ('legacy', 10, 2, 3, 15, true);
    `);
    await applyMigrations(database, logger, migrations);
    const observations = await database.connection.runAndReadAll(`
      SELECT model, normalized_input, normalized_cached_input, normalized_uncached_input,
        normalized_output, normalized_total, normalization_method, complete, anomaly_codes, legacy
      FROM codex_usage_observations WHERE session_id = 'legacy'
    `);
    expect(observations.getRowObjects()).toEqual([
      {
        model: "unknown",
        normalized_input: 10n,
        normalized_cached_input: 2n,
        normalized_uncached_input: 8n,
        normalized_output: 3n,
        normalized_total: 13n,
        normalization_method: "legacy_aggregate",
        complete: false,
        anomaly_codes: '["legacy_aggregate"]',
        legacy: true,
      },
    ]);
    const summary = await database.connection.runAndReadAll(`
      SELECT total_tokens, total_complete, anomaly_codes
      FROM codex_session_usage WHERE session_id = 'legacy'
    `);
    expect(summary.getRowObjects()).toEqual([
      { total_tokens: 13n, total_complete: false, anomaly_codes: '["legacy_aggregate"]' },
    ]);
    database.close();
  });

  test("rejects a changed checksum", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);
    const [foundation] = await loadMigrations();
    const changed = { ...foundation!, checksum: "changed" };
    expect(await captureError(applyMigrations(database, logger, [changed]))).toBeInstanceOf(
      MigrationError,
    );
    database.close();
  });

  test("rolls back a failing migration atomically", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);
    const sql = "CREATE TABLE should_rollback (id INTEGER); INVALID SQL";
    const failing: Migration = {
      version: 5,
      name: "forced-failure",
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    };

    const error = await captureError(
      applyMigrations(database, logger, [...(await loadMigrations()), failing]),
    );
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as Error).message).toMatch(/Migration 5 \(forced-failure\)/u);
    const tables = await database.connection.runAndReadAll(
      "SELECT count(*) AS count FROM information_schema.tables WHERE table_name = 'should_rollback'",
    );
    expect(tables.getRowObjects()[0]?.count).toBe(0n);
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(5);
    database.close();
  });

  test("creates immutable cost generation and item tables with decimal provenance", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);
    const columns = await database.connection.runAndReadAll(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('cost_calculation_generations', 'cost_calculation_items')
        AND column_name IN (
          'source_fact_revision', 'pricing_content_hash', 'uncached_input_rate',
          'estimated_cost_usd', 'gap_codes'
        )
      ORDER BY table_name, column_name
    `);
    expect(columns.getRowObjects()).toEqual([
      {
        table_name: "cost_calculation_generations",
        column_name: "pricing_content_hash",
        data_type: "VARCHAR",
      },
      {
        table_name: "cost_calculation_generations",
        column_name: "source_fact_revision",
        data_type: "VARCHAR",
      },
      {
        table_name: "cost_calculation_items",
        column_name: "estimated_cost_usd",
        data_type: "DECIMAL(38,24)",
      },
      {
        table_name: "cost_calculation_items",
        column_name: "gap_codes",
        data_type: "VARCHAR",
      },
      {
        table_name: "cost_calculation_items",
        column_name: "uncached_input_rate",
        data_type: "DECIMAL(38,24)",
      },
    ]);
    database.close();
  });
});
