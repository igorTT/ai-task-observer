import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Logger } from "pino";

import type { AppDatabase } from "./database.js";
import { MigrationRepository } from "@/database/repositories/migration-repository.js";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly sql: string;
}

export class MigrationError extends Error {
  public constructor(
    public readonly migration: Pick<Migration, "version" | "name">,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`Migration ${migration.version} (${migration.name}) failed: ${message}`, options);
    this.name = "MigrationError";
  }
}

export async function loadMigrations(
  directory = fileURLToPath(new URL("./migrations", import.meta.url)),
): Promise<Migration[]> {
  const filenames = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9-]+\.sql$/u.test(name))
    .sort();
  const migrations = await Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(join(directory, filename), "utf8");
      const match = /^(\d{3})_(.+)\.sql$/u.exec(filename);
      if (!match?.[1] || !match[2]) throw new Error(`Invalid migration filename: ${filename}`);
      return {
        version: Number(match[1]),
        name: match[2],
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    }),
  );

  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index - 1]!.version >= migrations[index]!.version) {
      throw new Error("Migration versions must be unique and strictly increasing");
    }
  }
  return migrations;
}

export async function applyMigrations(
  database: AppDatabase,
  logger: Logger,
  migrations?: readonly Migration[],
): Promise<void> {
  const availableMigrations = migrations ?? (await loadMigrations());
  const repository = new MigrationRepository(database.connection);
  const applied = await repository.findAll();
  const byVersion = new Map(applied.map((migration) => [migration.version, migration]));

  for (const migration of availableMigrations) {
    const existing = byVersion.get(migration.version);
    if (existing) {
      if (existing.name !== migration.name || existing.checksum !== migration.checksum) {
        throw new MigrationError(migration, "the applied name or checksum no longer matches");
      }
      continue;
    }

    try {
      await database.connection.run("BEGIN TRANSACTION");
      await database.connection.run(migration.sql);
      await repository.insert(migration.version, migration.name, migration.checksum);
      await database.connection.run("COMMIT");
      logger.info({ migration: migration.version, name: migration.name }, "migration applied");
    } catch (error) {
      try {
        await database.connection.run("ROLLBACK");
      } catch {
        // Preserve the original migration failure.
      }
      throw new MigrationError(migration, error instanceof Error ? error.message : String(error), {
        cause: error,
      });
    }
  }
}
