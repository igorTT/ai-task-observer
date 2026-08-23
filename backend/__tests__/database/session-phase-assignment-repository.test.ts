import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { SessionPhaseAssignmentRepository } from "@/database/repositories/session-phase-assignment-repository.js";

const databases: AppDatabase[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("SessionPhaseAssignmentRepository", () => {
  test("looks up, replaces idempotently, and clears an explicit phase", async () => {
    const directory = await mkdtemp(join(tmpdir(), "session-phase-repository-"));
    directories.push(directory);
    const database = await AppDatabase.open(join(directory, "test.duckdb"));
    databases.push(database);
    await applyMigrations(database, pino({ enabled: false }));
    await database.connection.run(`
      INSERT INTO codex_sessions (
        session_id, source_root, source_path, import_state, parser_version
      ) VALUES ('session', '/root', '/root/session.jsonl', 'ready', 2)
    `);

    const repository = new SessionPhaseAssignmentRepository(database.connection);
    expect(await repository.findBySessionId("session")).toBeUndefined();
    await repository.upsert("session", "research");
    expect(await repository.findBySessionId("session")).toEqual({
      sessionId: "session",
      phase: "research",
    });
    await repository.upsert("session", "research");
    await repository.upsert("session", "quick-flow");
    expect(await repository.findBySessionId("session")).toMatchObject({ phase: "quick-flow" });
    await repository.clear("session");
    expect(await repository.findBySessionId("session")).toBeUndefined();
  });
});
