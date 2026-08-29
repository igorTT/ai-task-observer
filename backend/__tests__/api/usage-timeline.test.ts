import { once } from "node:events";
import type { Server } from "node:http";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { createApp } from "@/app.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { UsageTimelineRepository } from "@/database/repositories/usage-timeline-repository.js";
import { UsageTimelineQueryService } from "@/modules/usage-timeline/query-service.js";
import type { UsageTimelineResponse } from "@/api/models/usage-timeline-response.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("usage timeline API", () => {
  test("returns default and explicit ranges across linked and unlinked usage", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      INSERT INTO codex_usage_observations (
        observation_id, session_id, source_path, source_identity, source_record_number,
        parser_version, model, event_time, normalized_input, normalized_cached_input,
        normalized_uncached_input, normalized_output, normalized_total,
        normalization_epoch, normalization_method, complete, anomaly_codes, legacy
      ) VALUES (
        'obs-http-range', 'session-u', '/root/u.jsonl', 'u', 12, 2, 'gpt-alias-a',
        '2026-08-01T15:00:00.000Z', 1, 0, 1, 0, 1, 0, 'standalone_delta', true, '[]', false
      )
    `);
    const app = appFor(fixture);
    await withApp(app, async (server) => {
      const defaultResponse = await request(server).get("/api/usage/timeline");
      const defaultBody = defaultResponse.body as UsageTimelineResponse;
      expect(defaultResponse.status).toBe(200);
      expect(defaultBody.range).toBe("12h");
      expect(defaultBody.sessionPhase).toBeNull();
      expect(defaultBody.totals.totalTokens).toBe("63");
      expect(defaultBody.buckets.length).toBeGreaterThan(1);

      const explicitResponse = await request(server).get("/api/usage/timeline?range=24h");
      const explicitBody = explicitResponse.body as UsageTimelineResponse;
      expect(explicitResponse.status).toBe(200);
      expect(explicitBody.range).toBe("24h");
      expect(explicitBody.sessionPhase).toBeNull();
      expect(explicitBody.totals.totalTokens).toBe("64");
      expect(JSON.stringify(explicitBody)).not.toContain("/root/");
      expect(JSON.stringify(explicitBody)).not.toContain("selected");
    });
  });

  test("rejects unsupported ranges with a documented validation response", async () => {
    fixture = await createIssueUsageFixture();
    await withApp(appFor(fixture), async (server) => {
      const response = await request(server).get("/api/usage/timeline?range=7d");
      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        error: { code: "validation_error", message: "range must be one of 12h or 24h" },
      });
    });
  });

  test("filters and echoes canonical and unassigned session phases", async () => {
    fixture = await createIssueUsageFixture();
    const app = appFor(fixture);
    await withApp(app, async (server) => {
      const canonical = await request(server).get(
        "/api/usage/timeline?range=12h&sessionPhase=explore",
      );
      expect(canonical.status).toBe(200);
      expect(canonical.body).toMatchObject({
        range: "12h",
        sessionPhase: "explore",
        unknownTimeObservationCount: "1",
        totals: { totalTokens: "55" },
      });

      const unassigned = await request(server).get(
        "/api/usage/timeline?range=12h&sessionPhase=unassigned",
      );
      expect(unassigned.status).toBe(200);
      expect(unassigned.body).toMatchObject({
        sessionPhase: "unassigned",
        unknownTimeObservationCount: "0",
        totals: { totalTokens: "8" },
      });
    });
  });

  test("rejects unsupported session phases without exposing internals", async () => {
    fixture = await createIssueUsageFixture();
    await withApp(appFor(fixture), async (server) => {
      const response = await request(server).get("/api/usage/timeline?sessionPhase=not-a-phase");
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: { code: "validation_error", message: "Request validation failed" },
      });
      expect(JSON.stringify(response.body)).not.toContain("/root/");
    });
  });
});

function appFor(activeFixture: IssueUsageFixture) {
  const costs = new CostCalculationRepository(activeFixture.database.connection);
  return createApp({
    logger: pino({ enabled: false }),
    api: {
      ingestion: {
        status: () => Promise.reject(new Error("unused")),
        rescan: () => Promise.reject(new Error("unused")),
      },
      sessions: {} as never,
      linear: {
        status: () => Promise.reject(new Error("unused")),
        sync: () => Promise.reject(new Error("unused")),
        relink: () => Promise.reject(new Error("unused")),
      },
      usageTimeline: new UsageTimelineQueryService({
        repository: new UsageTimelineRepository(activeFixture.database.connection),
        costs: {
          status: async () => {
            const latestCompleted = await costs.latestCompleted();
            return {
              currentFactRevision: "current-revision",
              coverage: "current" as const,
              ...(latestCompleted ? { latestCompleted } : {}),
            };
          },
        },
        now: () => new Date("2026-08-02T14:00:00.000Z"),
      }),
    },
  });
}

async function withApp<T>(
  app: ReturnType<typeof createApp>,
  assertion: (server: Server) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const server = app.listen(30_000 + Math.floor(Math.random() * 20_000), "127.0.0.1");
    try {
      await once(server, "listening");
      try {
        return await assertion(server);
      } finally {
        server.close();
        await once(server, "close");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error("Could not allocate an HTTP test port");
}
