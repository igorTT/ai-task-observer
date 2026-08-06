import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { MigrationRepository } from "@/database/repositories/migration-repository.js";

test("Bun loads DuckDB, migrates a file, queries it, closes it, and reopens it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "duckdb-compatibility-"));
  const path = join(directory, "compatibility.duckdb");
  try {
    const database = await AppDatabase.open(path);
    await applyMigrations(database, pino({ enabled: false }));
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(1);
    database.close();

    const reopened = await AppDatabase.open(path);
    expect(await new MigrationRepository(reopened.connection).findAll()).toHaveLength(1);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
