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

async function databaseAtVersionTwo(): Promise<AppDatabase> {
  const { database } = await temporaryDatabase();
  const migrations = await loadMigrations();
  await applyMigrations(database, logger, migrations.slice(0, 2));
  return database;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("migration runner", () => {
  test("creates the current schema baseline and records all migrations", async () => {
    const { database } = await temporaryDatabase();
    await applyMigrations(database, logger);

    const records = await new MigrationRepository(database.connection).findAll();
    expect(records).toHaveLength(3);
    expect(records[0]?.name).toBe("initial");
    expect(records[1]?.name).toBe("session-phase-assignments");
    expect(records[2]?.name).toBe("consolidate-codex-import-checkpoints");

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
      "codex_usage_observations",
      "cost_calculation_generations",
      "cost_calculation_items",
      "linear_issues",
      "linear_session_attributions",
      "linear_sync_runs",
      "schema_migrations",
      "session_phase_assignments",
    ]);
    const checkpointColumns = await database.connection.runAndReadAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'codex_import_checkpoints'
      ORDER BY ordinal_position
    `);
    expect(checkpointColumns.getRowObjects().map((row) => row.column_name)).toContain(
      "normalization_epoch",
    );
    expect(checkpointColumns.getRowObjects().map((row) => row.column_name)).not.toContain(
      "observed_modified_at_ms",
    );
    database.close();
  });

  test("reopens a current database without duplicating effects", async () => {
    const opened = await temporaryDatabase();
    await applyMigrations(opened.database, logger);
    opened.database.close();

    const reopened = await AppDatabase.open(opened.path);
    await applyMigrations(reopened, logger);
    expect(await new MigrationRepository(reopened.connection).findAll()).toHaveLength(3);
    reopened.close();
  });

  test("merges populated continuation and checkpoint metadata without changing prior checksums", async () => {
    const database = await databaseAtVersionTwo();
    const priorRecords = await new MigrationRepository(database.connection).findAll();
    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, import_state, parser_version
      ) VALUES ('migration-session', '/root', '/root/session.jsonl', 'stale', 7);
      INSERT INTO codex_import_checkpoints (
        source_path, source_root, source_identity, committed_offset, observed_size,
        observed_modified_at_ms, parser_version, status, unknown_records,
        malformed_records, last_error, created_at, updated_at
      ) VALUES (
        '/root/session.jsonl', '/root', 'identity-v1', 321, 400, 999, 7,
        'stale', 3, 4, 'sanitized-status',
        TIMESTAMPTZ '2024-01-02 03:04:05+00', TIMESTAMPTZ '2024-02-03 04:05:06+00'
      );
      INSERT INTO codex_source_parse_state (
        source_path, session_id, source_identity, parser_version, active_model,
        normalization_epoch, baseline_input, baseline_cached_input, baseline_output,
        next_record_number, fact_revision, updated_at
      ) VALUES (
        '/root/session.jsonl', 'migration-session', 'identity-v1', 7, 'private-model',
        2, 12345, NULL, 6789, 17, 41, TIMESTAMPTZ '2024-03-04 05:06:07+00'
      );
    `);

    await applyMigrations(database, logger);

    const merged = await database.connection.runAndReadAll(`
      SELECT source_root, source_identity, committed_offset, observed_size,
        parser_version, session_id, active_model, normalization_epoch,
        baseline_input, baseline_cached_input, baseline_output, next_record_number,
        status, unknown_records, malformed_records, last_error,
        epoch_ms(created_at) AS created_ms, epoch_ms(updated_at) AS updated_ms
      FROM codex_import_checkpoints WHERE source_path = '/root/session.jsonl'
    `);
    expect(merged.getRowObjects()[0]).toEqual({
      source_root: "/root",
      source_identity: "identity-v1",
      committed_offset: 321n,
      observed_size: 400n,
      parser_version: 7,
      session_id: "migration-session",
      active_model: "private-model",
      normalization_epoch: 2,
      baseline_input: 12345n,
      baseline_cached_input: null,
      baseline_output: 6789n,
      next_record_number: 17n,
      status: "stale",
      unknown_records: 3,
      malformed_records: 4,
      last_error: "sanitized-status",
      created_ms: 1704164645000n,
      updated_ms: 1706933106000n,
    });
    const priorAfter = await new MigrationRepository(database.connection).findAll();
    expect(
      priorAfter.slice(0, 2).map(({ version, name, checksum }) => ({ version, name, checksum })),
    ).toEqual(priorRecords.map(({ version, name, checksum }) => ({ version, name, checksum })));
    const removed = await database.connection.runAndReadAll(`
      SELECT count(*) AS count FROM information_schema.tables
      WHERE table_schema = 'main' AND table_name = 'codex_source_parse_state'
    `);
    expect(removed.getRowObjects()[0]?.count).toBe(0n);
    database.close();
  });

  test("rejects inconsistent continuation with sanitized diagnostics and rolls back schema and data", async () => {
    const scenarios = [
      { category: "missing_continuation", checkpoint: true, continuation: false, session: true },
      { category: "orphan_continuation", checkpoint: false, continuation: true, session: true },
      { category: "identity_mismatch", checkpoint: true, continuation: true, session: true },
      {
        category: "identity_mismatch",
        checkpoint: true,
        continuation: true,
        session: true,
        versionMismatch: true,
      },
      { category: "missing_session", checkpoint: true, continuation: true, session: false },
    ] as const;

    for (const scenario of scenarios) {
      const database = await databaseAtVersionTwo();
      if (scenario.session) {
        await database.connection.run(`
          INSERT INTO codex_sessions (
            session_id, source_root, source_path, import_state, parser_version
          ) VALUES ('migration-session', '/root', '/root/session.jsonl', 'ready', 7)
        `);
      }
      if (scenario.checkpoint) {
        await database.connection.run(`
          INSERT INTO codex_import_checkpoints (
            source_path, source_root, source_identity, parser_version, status
          ) VALUES ('/private/source.jsonl', '/root', 'identity-v1', 7, 'ready')
        `);
      }
      if (scenario.continuation) {
        await database.connection.run(`
          INSERT INTO codex_source_parse_state (
            source_path, session_id, source_identity, parser_version, active_model,
            normalization_epoch, next_record_number
          ) VALUES (
            '/private/source.jsonl',
            '${scenario.session ? "migration-session" : "missing-session-secret"}',
            '${scenario.category === "identity_mismatch" && !("versionMismatch" in scenario) ? "different-identity-secret" : "identity-v1"}',
            ${"versionMismatch" in scenario && scenario.versionMismatch ? 8 : 7},
            'private-model-secret', 0, 1
          )
        `);
      }

      const error = await captureError(applyMigrations(database, logger));
      expect(error).toBeInstanceOf(MigrationError);
      expect((error as Error).message).toContain(`checkpoint_merge_${scenario.category}:1`);
      expect((error as Error).message).not.toContain("/private/source.jsonl");
      expect((error as Error).message).not.toContain("private-model-secret");
      expect((error as Error).message).not.toContain("missing-session-secret");

      const legacyTables = await database.connection.runAndReadAll(`
        SELECT count(*) AS count FROM information_schema.tables
        WHERE table_schema = 'main' AND table_name = 'codex_source_parse_state'
      `);
      expect(legacyTables.getRowObjects()[0]?.count).toBe(1n);
      const legacyColumn = await database.connection.runAndReadAll(`
        SELECT count(*) AS count FROM information_schema.columns
        WHERE table_name = 'codex_import_checkpoints'
          AND column_name = 'observed_modified_at_ms'
      `);
      expect(legacyColumn.getRowObjects()[0]?.count).toBe(1n);
      const rowCounts = await database.connection.runAndReadAll(`
        SELECT
          (SELECT count(*) FROM codex_import_checkpoints) AS checkpoints,
          (SELECT count(*) FROM codex_source_parse_state) AS continuations
      `);
      expect(rowCounts.getRowObjects()[0]).toEqual({
        checkpoints: scenario.checkpoint ? 1n : 0n,
        continuations: scenario.continuation ? 1n : 0n,
      });
      database.close();
    }
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
        ('codex_import_checkpoints', 'created_at'),
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
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(3);
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
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(3);
    database.close();
  });
});
