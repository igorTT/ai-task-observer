import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { LinearSyncRunRepository } from "@/database/repositories/linear-sync-run-repository.js";

const directories: string[] = [];
const databases: AppDatabase[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Linear attribution repositories", () => {
  test("map parameterized issue, attribution, and durable run queries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linear-repositories-"));
    directories.push(directory);
    const database = await AppDatabase.open(join(directory, "test.duckdb"));
    databases.push(database);
    await applyMigrations(database, pino({ enabled: false }));
    const sessions = new CodexSessionRepository(database.connection);
    const issues = new LinearIssueRepository(database.connection);
    const attributions = new LinearSessionAttributionRepository(database.connection);
    const runs = new LinearSyncRunRepository(database.connection);
    await sessions.upsert(
      {
        sessionId: "session-'safe",
        sourceRoot: "/root",
        sourcePath: "/root/session.jsonl",
        title: "ENG-42: apply",
      },
      2,
    );
    const synchronizedAt = new Date("2026-08-09T10:00:00.000Z");
    await issues.upsert(
      {
        linearId: "linear-'safe",
        identifier: "ENG-42",
        title: "Ship attribution",
        url: "https://linear.app/example/issue/ENG-42",
        team: { id: "team", key: "ENG", name: "Engineering" },
        state: { id: "state", name: "In Progress" },
        updatedAt: new Date("2026-08-09T09:00:00.000Z"),
      },
      synchronizedAt,
    );
    await attributions.save({
      sessionId: "session-'safe",
      titleFingerprint: "fingerprint",
      candidateIdentifier: "ENG-42",
      phase: "apply",
      status: "linked",
      linearId: "linear-'safe",
      lastAttemptAt: synchronizedAt,
      lastSuccessAt: synchronizedAt,
    });
    await runs.create("run-'safe", "manual");
    await runs.setState("run-'safe", "running");
    await runs.setCounts("run-'safe", {
      candidateCount: 1,
      linkedCount: 1,
      notFoundCount: 0,
      errorCount: 0,
    });
    await runs.setState("run-'safe", "completed");

    expect(await issues.findByIdentifier("ENG-42")).toMatchObject({
      linearId: "linear-'safe",
      team: { key: "ENG" },
      syncedAt: synchronizedAt,
    });
    expect(await attributions.findBySessionId("session-'safe")).toMatchObject({
      status: "linked",
      candidateIdentifier: "ENG-42",
      phase: "apply",
    });
    await attributions.save({
      sessionId: "session-'safe",
      titleFingerprint: "renamed-fingerprint",
      candidateIdentifier: "ENG-99",
      status: "linked",
      linearId: "linear-'safe",
    });
    expect(await attributions.findBySessionId("session-'safe")).toMatchObject({
      status: "linked",
      candidateIdentifier: "ENG-99",
      linearId: "linear-'safe",
    });
    await attributions.save({
      sessionId: "session-'safe",
      titleFingerprint: "ordinary-title-fingerprint",
      status: "linked",
      linearId: "linear-'safe",
    });
    expect(await attributions.findBySessionId("session-'safe")).toMatchObject({
      status: "linked",
      linearId: "linear-'safe",
    });
    expect(
      (await attributions.findBySessionId("session-'safe"))?.candidateIdentifier,
    ).toBeUndefined();
    expect(await attributions.counts()).toMatchObject({ linked: 1, unlinked: 0 });
    expect(await runs.latestCompleted()).toMatchObject({
      runId: "run-'safe",
      state: "completed",
      linkedCount: 1,
    });
  });

  test("refreshes an issue after one session references it and links a second session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linear-repositories-shared-issue-"));
    directories.push(directory);
    const database = await AppDatabase.open(join(directory, "test.duckdb"));
    databases.push(database);
    await applyMigrations(database, pino({ enabled: false }));
    const sessions = new CodexSessionRepository(database.connection);
    const issues = new LinearIssueRepository(database.connection);
    const attributions = new LinearSessionAttributionRepository(database.connection);
    for (const sessionId of ["session-1", "session-2"]) {
      await sessions.upsert(
        {
          sessionId,
          sourceRoot: "/root",
          sourcePath: `/root/${sessionId}.jsonl`,
          title: "ENG-42",
        },
        2,
      );
    }
    const issue = {
      linearId: "issue-42",
      identifier: "ENG-42",
      title: "Initial title",
      url: "https://linear.app/example/issue/ENG-42",
      team: { id: "team", key: "ENG", name: "Engineering" },
      state: { id: "state", name: "In Progress" },
      updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    };
    await issues.upsert(issue, new Date("2026-08-09T10:00:00.000Z"));
    await attributions.save({
      sessionId: "session-1",
      titleFingerprint: "first",
      candidateIdentifier: "ENG-42",
      status: "linked",
      linearId: "issue-42",
    });

    const refreshedAt = new Date("2026-08-09T11:00:00.000Z");
    await issues.upsert({ ...issue, title: "Refreshed title" }, refreshedAt);
    await attributions.save({
      sessionId: "session-2",
      titleFingerprint: "second",
      candidateIdentifier: "ENG-42",
      status: "linked",
      linearId: "issue-42",
    });

    expect(await issues.findById("issue-42")).toMatchObject({
      title: "Refreshed title",
      syncedAt: refreshedAt,
    });
    expect(
      (await attributions.list()).map(({ sessionId, linearId }) => ({ sessionId, linearId })),
    ).toEqual([
      { sessionId: "session-1", linearId: "issue-42" },
      { sessionId: "session-2", linearId: "issue-42" },
    ]);
  });
});
