import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  test("creates the current schema baseline and records one migration", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);

    const records = await new MigrationRepository(database.connection).findAll();
    expect(records).toHaveLength(2);
    expect(records[0]?.name).toBe("initial");
    expect(records[1]?.name).toBe("session-phase-assignments");

    const tables = await database.connection.runAndReadAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    expect(tables.getRowObjects().map((row) => row.table_name)).toEqual([
      "codex_import_checkpoints",
      "codex_import_runs",
      "codex_session_events",
      "codex_session_usage",
      "codex_sessions",
      "codex_source_parse_state",
      "codex_usage_observations",
      "cost_calculation_generations",
      "cost_calculation_items",
      "linear_issues",
      "linear_session_attributions",
      "linear_sync_runs",
      "schema_migrations",
      "session_phase_assignments",
    ]);
    database.close();
  });

  test("reopens a current database without duplicating effects", async () => {
    const opened = await temporaryDatabase();
    await applyMigrations(opened.database, logger);
    opened.database.close();

    const reopened = await AppDatabase.open(opened.path);
    await applyMigrations(reopened, logger);
    expect(await new MigrationRepository(reopened.connection).findAll()).toHaveLength(2);
    reopened.close();
  });

  test("keeps timestamp fields timezone-aware and retains indexes and constraints", async () => {
    const { database } = await temporaryDatabase();
    await database.connection.run("SET TimeZone = 'Europe/Bratislava'");
    await applyMigrations(database, logger);

    const columns = await database.connection.runAndReadAll(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE (table_name, column_name) IN (
        ('schema_migrations', 'applied_at'),
        ('codex_sessions', 'started_at'),
        ('codex_sessions', 'created_at'),
        ('codex_session_usage', 'updated_at'),
        ('codex_import_checkpoints', 'updated_at'),
        ('codex_import_runs', 'completed_at'),
        ('linear_issues', 'linear_updated_at'),
        ('linear_session_attributions', 'last_attempt_at'),
        ('linear_sync_runs', 'completed_at'),
        ('codex_session_events', 'event_time'),
        ('codex_usage_observations', 'event_time'),
        ('codex_source_parse_state', 'updated_at'),
        ('cost_calculation_generations', 'started_at'),
        ('cost_calculation_items', 'observation_time')
      )
      ORDER BY table_name, column_name
    `);
    expect(
      columns.getRowObjects().every((row) => row.data_type === "TIMESTAMP WITH TIME ZONE"),
    ).toBe(true);

    const indexes = await database.connection.runAndReadAll(`
      SELECT index_name
      FROM duckdb_indexes()
      WHERE index_name IN (
        'codex_sessions_source_path_idx',
        'linear_issues_synced_at_idx',
        'linear_session_attributions_status_idx',
        'linear_sync_runs_completed_at_idx',
        'codex_session_events_source_idx',
        'codex_usage_observations_source_idx',
        'cost_calculation_items_session_idx'
      )
      ORDER BY index_name
    `);
    expect(indexes.getRowObjects().map((row) => row.index_name)).toEqual([
      "codex_session_events_source_idx",
      "codex_sessions_source_path_idx",
      "codex_usage_observations_source_idx",
      "cost_calculation_items_session_idx",
      "linear_issues_synced_at_idx",
      "linear_session_attributions_status_idx",
      "linear_sync_runs_completed_at_idx",
    ]);

    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, import_state, parser_version
      ) VALUES ('constraint-session', '/root', '/root/session.jsonl', 'ready', 3)
    `);
    const duplicateSourcePathError = await captureError(
      database.connection.run(`
        INSERT INTO codex_sessions (
          session_id, source_root, source_path, import_state, parser_version
        ) VALUES ('duplicate-session', '/root', '/root/session.jsonl', 'ready', 3)
      `),
    );
    expect(duplicateSourcePathError).toBeInstanceOf(Error);

    const foreignKeyError = await captureError(
      database.connection.run(`
        INSERT INTO linear_session_attributions (
          session_id, title_fingerprint, resolution_status
        ) VALUES ('missing-session', 'fingerprint', 'unlinked')
      `),
    );
    expect(foreignKeyError).toBeInstanceOf(Error);
    database.close();
  });

  test("canonicalizes legacy phases, preserves null, enforces the new constraint, and is repeatable", async () => {
    const { database } = await temporaryDatabase();
    const migrations = await loadMigrations();
    const initial = migrations[0];
    if (!initial) throw new Error("Initial migration is missing");
    await applyMigrations(database, logger, [initial]);
    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, import_state, parser_version
      ) VALUES
        ('phase-canonical', '/root', '/root/canonical.jsonl', 'ready', 2),
        ('phase-custom', '/root', '/root/custom.jsonl', 'ready', 2),
        ('phase-null', '/root', '/root/null.jsonl', 'ready', 2);
      INSERT INTO linear_session_attributions (
        session_id, title_fingerprint, resolution_status, phase
      ) VALUES
        ('phase-canonical', 'canonical', 'unlinked', 'quick-flow'),
        ('phase-custom', 'custom', 'unlinked', 'review'),
        ('phase-null', 'null', 'unlinked', NULL);
    `);

    await applyMigrations(database, logger, migrations);
    const assignments = await database.connection.runAndReadAll(
      "SELECT session_id, phase FROM session_phase_assignments ORDER BY session_id",
    );
    expect(assignments.getRowObjects()).toEqual([
      { session_id: "phase-canonical", phase: "quick-flow" },
      { session_id: "phase-custom", phase: "other" },
    ]);
    const legacyColumn = await database.connection.runAndReadAll(`
      SELECT count(*) AS count
      FROM information_schema.columns
      WHERE table_name = 'linear_session_attributions' AND column_name = 'phase'
    `);
    expect(legacyColumn.getRowObjects()[0]?.count).toBe(0n);

    const invalid = await captureError(
      database.connection.run(
        "INSERT INTO session_phase_assignments (session_id, phase) VALUES ('phase-null', 'invalid')",
      ),
    );
    expect(invalid).toBeInstanceOf(Error);

    await applyMigrations(database, logger, migrations);
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(2);
    database.close();
  });

  test("rejects a changed checksum", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);
    const [initial] = await loadMigrations();
    const changed = { ...initial!, checksum: "changed" };
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
      version: 2,
      name: "forced-failure",
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    };

    const error = await captureError(
      applyMigrations(database, logger, [...(await loadMigrations()), failing]),
    );
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as Error).message).toMatch(/Migration 2 \(forced-failure\)/u);
    const tables = await database.connection.runAndReadAll(
      "SELECT count(*) AS count FROM information_schema.tables WHERE table_name = 'should_rollback'",
    );
    expect(tables.getRowObjects()[0]?.count).toBe(0n);
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(2);
    database.close();
  });
});
