import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import type { SessionResponse } from "@/api/models/session-response.js";
import { configureApiDependencies } from "@/api/dependencies.js";
import { SessionsController } from "@/api/controllers/sessions.controller.js";
import { CodexSessionEventRepository } from "@/database/repositories/codex-session-event-repository.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("non-UTC timestamp API regression", () => {
  test("preserves lifecycle, attribution, issue, and selected-event instants", async () => {
    fixture = await createIssueUsageFixture();
    const sessions = new CodexSessionRepository(fixture.database.connection);
    const attributions = new LinearSessionAttributionRepository(fixture.database.connection);
    const issues = new LinearIssueRepository(fixture.database.connection);
    configureApiDependencies({
      ingestion: {
        status: () => Promise.resolve({ roots: [], checkpoints: [], acceptingWork: true }),
        rescan: () =>
          Promise.resolve({ runId: "unused", state: "queued" as const, coalesced: false }),
      },
      sessions: new SessionQueryService(
        sessions,
        new CodexSessionUsageRepository(fixture.database.connection),
        attributions,
        issues,
      ),
      linear: {
        status: () => Promise.reject(new Error("unused")),
        sync: () => Promise.reject(new Error("unused")),
        relink: () => Promise.reject(new Error("unused")),
      },
    });

    const body: SessionResponse = await new SessionsController().detail("session-a");
    expect(body).toMatchObject({
      startedAt: "2026-08-01T08:00:00.000Z",
      endedAt: "2026-08-02T09:00:00.000Z",
      attribution: {
        lastAttemptAt: "2026-08-01T00:00:00.000Z",
        lastSuccessAt: "2026-08-01T00:00:00.000Z",
        issue: {
          updatedAt: "2026-08-01T00:00:00.000Z",
          synchronizedAt: "2026-08-01T00:00:00.000Z",
        },
      },
    });

    const events = await new CodexSessionEventRepository(
      fixture.database.connection,
    ).listBySessionId("session-a");
    expect(events.map((event) => event.eventTime?.toISOString() ?? null)).toEqual([
      "2026-08-01T10:00:00.000Z",
      "2026-08-01T11:00:00.000Z",
      "2026-08-02T09:00:00.000Z",
    ]);
  });
});
