import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import { createApp } from "@/app.js";
import type { SessionPhaseResponse } from "@/api/models/session-phase-response.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { SessionPhaseAssignmentRepository } from "@/database/repositories/session-phase-assignment-repository.js";
import { titleFingerprint } from "@/modules/linear/attribution-state.js";
import { SessionPhaseService } from "@/modules/sessions/session-phase-service.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";
import type { SessionPhase } from "@/modules/sessions/domain.js";

const databases: AppDatabase[] = [];
const directories: string[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "session-phase-api-"));
  directories.push(directory);
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  databases.push(database);
  await applyMigrations(database, pino({ enabled: false }));
  const ingestion = new CodexIngestionRepository(database);
  const attributions = new LinearSessionAttributionRepository(database.connection);
  const assignments = new SessionPhaseAssignmentRepository(database.connection);
  await ingestion.sessions.upsert(
    {
      sessionId: "session-phase",
      sourceRoot: "/root",
      sourcePath: "/root/session-phase.jsonl",
      title: "ENG-42: apply",
    },
    2,
  );
  await ingestion.usage.ensure("session-phase");
  await attributions.save({
    sessionId: "session-phase",
    titleFingerprint: titleFingerprint("ENG-42: apply"),
    candidateIdentifier: "ENG-42",
    status: "unlinked",
  });
  const query = new SessionQueryService(
    ingestion.sessions,
    ingestion.usage,
    attributions,
    undefined,
    undefined,
    assignments,
  );
  const app = createApp({
    logger: pino({ enabled: false }),
    api: {
      ingestion: {
        status: () => Promise.resolve({ roots: [], checkpoints: [], acceptingWork: true }),
        rescan: () => Promise.reject(new Error("unused")),
      },
      sessions: query,
      phase: new SessionPhaseService({
        database,
        sessions: ingestion.sessions,
        assignments,
        query,
      }),
      linear: {
        status: () => Promise.reject(new Error("unused")),
        sync: () => Promise.reject(new Error("unused")),
        relink: () => Promise.reject(new Error("unused")),
      },
    },
  });
  return { app, assignments };
}

describe("session phase HTTP contract", () => {
  test("assigns every canonical phase, replaces idempotently, clears, validates, and handles missing sessions", async () => {
    const opened = await setup();
    await withServer(opened.app, async (server) => {
      const phases: readonly SessionPhase[] = [
        "research",
        "explore",
        "proposal",
        "apply",
        "verify",
        "quick-flow",
        "other",
      ];
      for (const phase of phases) {
        const response = await request(server)
          .put("/api/sessions/session-phase/phase")
          .send({ phase });
        expect(response.status).toBe(200);
        expect((response.body as SessionPhaseResponse).attribution).toMatchObject({
          status: "unlinked",
          candidateIdentifier: "ENG-42",
          phase,
        });
      }

      const repeated = await request(server)
        .put("/api/sessions/session-phase/phase")
        .send({ phase: "other" });
      expect(repeated.status).toBe(200);
      expect((await opened.assignments.findBySessionId("session-phase"))?.phase).toBe("other");

      const invalid = await request(server)
        .put("/api/sessions/session-phase/phase")
        .send({ phase: "review" });
      expect(invalid.status).toBe(422);
      expect((await opened.assignments.findBySessionId("session-phase"))?.phase).toBe("other");

      const missingBodyField = await request(server)
        .put("/api/sessions/session-phase/phase")
        .send({});
      expect(missingBodyField.status).toBe(422);

      const cleared = await request(server)
        .put("/api/sessions/session-phase/phase")
        .send({ phase: null });
      expect(cleared.status).toBe(200);
      expect((cleared.body as SessionPhaseResponse).attribution).not.toHaveProperty("phase");
      expect(await opened.assignments.findBySessionId("session-phase")).toBeUndefined();

      const missing = await request(server)
        .put("/api/sessions/unknown/phase")
        .send({ phase: "apply" });
      expect(missing.status).toBe(404);
      expect(missing.body).toMatchObject({ error: { code: "session_not_found" } });
      expect(await opened.assignments.findBySessionId("unknown")).toBeUndefined();
    });
  });
});

async function withServer<T>(
  app: ReturnType<typeof createApp>,
  assertion: (server: Server) => Promise<T>,
): Promise<T> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await assertion(server);
  } finally {
    server.close();
    await once(server, "close");
  }
}
