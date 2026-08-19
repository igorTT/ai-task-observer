import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { MigrationRepository } from "@/database/repositories/migration-repository.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { parseCodexRecords } from "@/modules/sessions/parser.js";

test("Bun loads DuckDB, migrates a file, queries it, closes it, and reopens it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "duckdb-compatibility-"));
  const path = join(directory, "compatibility.duckdb");
  try {
    const database = await AppDatabase.open(path);
    await applyMigrations(database, pino({ enabled: false }));
    expect(await new MigrationRepository(database.connection).findAll()).toHaveLength(5);
    const ingestion = new CodexIngestionRepository(database);
    await ingestion.runs.create("compatibility-run", "startup");
    await ingestion.runs.setState("compatibility-run", "running");
    const parsed = parseCodexRecords(
      [
        JSON.stringify({
          type: "session_meta",
          payload: { id: "compatibility-session" },
        }),
        JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "hello" } }),
        JSON.stringify({
          type: "token_usage",
          payload: { input_tokens: 2, cached_input_tokens: 1, output_tokens: 3 },
        }),
      ],
      {
        sourceRoot: "/synthetic",
        sourcePath: "/synthetic/compatibility.jsonl",
        sourceIdentity: "1:1",
      },
    );
    if (!parsed.parseState) throw new Error("fixture did not produce parse state");
    await ingestion.applySourceChunk({
      sourcePath: "/synthetic/compatibility.jsonl",
      sourceRoot: "/synthetic",
      sourceIdentity: "1:1",
      committedOffset: 10n,
      observedSize: 10n,
      observedModifiedAtMs: 1n,
      parserVersion: 3,
      runId: "compatibility-run",
      rebuild: true,
      diagnostics: { unknownRecords: 0, malformedRecords: 0, warnings: [] },
      mutations: parsed.mutations,
      events: parsed.events,
      observations: parsed.observations,
      parseState: parsed.parseState,
    });
    await ingestion.runs.setState("compatibility-run", "completed");
    database.close();

    const reopened = await AppDatabase.open(path);
    expect(await new MigrationRepository(reopened.connection).findAll()).toHaveLength(5);
    const reopenedIngestion = new CodexIngestionRepository(reopened);
    expect(await reopenedIngestion.sessions.findById("compatibility-session")).toMatchObject({
      developerTurns: 1n,
    });
    expect(await reopenedIngestion.usage.findBySessionId("compatibility-session")).toMatchObject({
      totalTokens: 5n,
    });
    expect(
      await reopenedIngestion.checkpoints.find("/synthetic/compatibility.jsonl"),
    ).toMatchObject({ committedOffset: 10n });
    expect(await reopenedIngestion.runs.find("compatibility-run")).toMatchObject({
      state: "completed",
    });
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
