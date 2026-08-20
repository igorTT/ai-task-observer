import { once } from "node:events";
import type { Server } from "node:http";

import { afterEach, describe, expect, test } from "bun:test";
import pino from "pino";
import request from "supertest";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import type {
  IssueUsageDetailResponse,
  IssueUsageListResponse,
} from "@/api/models/issue-usage-response.js";
import { createApp } from "@/app.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { IssueUsageRepository } from "@/database/repositories/issue-usage-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { IssueUsageQueryService } from "@/modules/issues/issue-usage-query-service.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("issue usage API", () => {
  test("paginates deterministically and returns complete current-link detail", async () => {
    fixture = await createIssueUsageFixture();
    const app = appFor(fixture);
    await withApp(app, async (server) => {
      const page = await request(server).get("/api/issues/usage?limit=1&offset=1");
      const pageBody = page.body as IssueUsageListResponse;
      expect(page.status).toBe(200);
      expect(pageBody).toMatchObject({
        total: "2",
        limit: 1,
        offset: 1,
        items: [{ issue: { id: "issue-2", identifier: "ENG-2" } }],
      });
      expect(JSON.stringify(pageBody)).not.toContain("999");
      expect(JSON.stringify(pageBody)).not.toContain("ENG-9");

      const detail = await request(server).get("/api/issues/issue-1/usage");
      const detailBody = detail.body as IssueUsageDetailResponse;
      expect(detail.status).toBe(200);
      expect(detailBody.metrics).toMatchObject({
        sessionCount: "2",
        developerTurns: "4",
        inputTokens: "200",
        cachedInputTokens: null,
        outputTokens: "20",
        totalTokens: "220",
        estimatedCostUsd: "0.15",
        tokenComplete: false,
        costComplete: false,
      });
      expect(detailBody.sessions[0]).toMatchObject({
        sessionId: "session-b",
        phase: "apply",
        importState: "importing",
        lastError: "retained prior snapshot",
      });
      expect(detailBody.models.map((model) => model.model)).toEqual(["gpt-5.6", "unknown"]);
      expect(detailBody.daily.map((bucket) => bucket.date)).toEqual([
        "2026-08-01",
        "2026-08-02",
        null,
      ]);

      expect((await request(server).get("/api/issues/issue-empty/usage")).status).toBe(404);
      expect((await request(server).get("/api/issues/missing/usage")).status).toBe(404);
      expect((await request(server).get("/api/issues/usage?limit=0")).status).toBe(422);
      expect((await request(server).get("/api/issues/usage?offset=-1")).status).toBe(422);
    });
  });

  test("reflects a successful relink without moving history for a title candidate", async () => {
    fixture = await createIssueUsageFixture();
    const attributions = new LinearSessionAttributionRepository(fixture.database.connection);
    const app = appFor(fixture);
    await withApp(app, async (server) => {
      await attributions.save({
        sessionId: "session-a",
        titleFingerprint: "candidate-only",
        candidateIdentifier: "ENG-2",
        status: "linked",
        linearId: "issue-1",
      });
      const candidateDetail = await request(server).get("/api/issues/issue-1/usage");
      expect((candidateDetail.body as IssueUsageDetailResponse).metrics.inputTokens).toBe("200");

      await attributions.save({
        sessionId: "session-a",
        titleFingerprint: "relinked",
        candidateIdentifier: "ENG-2",
        status: "linked",
        linearId: "issue-2",
      });
      const oldIssue = await request(server).get("/api/issues/issue-1/usage");
      const newIssue = await request(server).get("/api/issues/issue-2/usage");
      expect((oldIssue.body as IssueUsageDetailResponse).metrics).toMatchObject({
        sessionCount: "1",
        inputTokens: "20",
      });
      expect((newIssue.body as IssueUsageDetailResponse).metrics).toMatchObject({
        sessionCount: "2",
        inputTokens: "187",
      });
    });
  });
});

function appFor(activeFixture: IssueUsageFixture) {
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
      issueUsage: new IssueUsageQueryService(
        new IssueUsageRepository(activeFixture.database.connection),
        new CostCalculationRepository(activeFixture.database.connection),
      ),
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
