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
    expect(records).toHaveLength(2);
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
    expect(records).toHaveLength(2);
    reopened.close();
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
