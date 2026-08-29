import { beforeEach, describe, expect, mock, test } from "bun:test";
import { dashboardApi } from "@/api/dashboard-api";
import { createAppStore } from "@/app/store";

describe("dashboard API cache tags", () => {
  let requests: string[];
  let relinkBody: unknown;
  let phaseBodies: unknown[];

  beforeEach(() => {
    requests = [];
    relinkBody = undefined;
    phaseBodies = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      const url = input instanceof Request ? input.url : String(input);
      requests.push(url);
      if (url.includes("/api/sessions/session-1/relink")) {
        if (input instanceof Request) relinkBody = await input.clone().json();
        return Response.json({ attribution: {} });
      }
      if (url.includes("/api/sessions/session-1/phase")) {
        if (input instanceof Request) phaseBodies.push(await input.clone().json());
        return Response.json({ attribution: {} });
      }
      if (url.includes("/api/sessions"))
        return Response.json({ items: [], total: 0, limit: 20, offset: 0 });
      if (url.includes("/api/issues/usage"))
        return Response.json({ items: [], total: "0", limit: 20, offset: 0 });
      if (url.includes("/api/usage/timeline"))
        return Response.json({
          range: "12h",
          bucketUnit: "hour",
          startAt: "2026-08-22T00:00:00.000Z",
          endAt: "2026-08-22T12:00:00.000Z",
          sessionPhase: null,
          totals: {
            totalTokens: "0",
            estimatedCostUsd: "0",
            tokenComplete: true,
            costComplete: true,
            completeness: { token: "complete", cost: "complete" },
            warnings: [],
          },
          buckets: [],
          unknownTimeObservationCount: "0",
          costCoverage: "missing",
          latestCompletedCostGeneration: null,
        });
      return Response.json({
        configured: false,
        state: "unconfigured",
        acceptingWork: false,
        counts: {},
      });
    }) as unknown as typeof fetch;
  });

  test("successful relink refreshes sessions, issue usage, and Linear status", async () => {
    const store = createAppStore();
    const subscriptions = [
      store.dispatch(dashboardApi.endpoints.list.initiate({ limit: 20, offset: 0 })),
      store.dispatch(dashboardApi.endpoints.listIssueUsage.initiate({ limit: 20, offset: 0 })),
      store.dispatch(dashboardApi.endpoints.status.initiate()),
    ];
    await Promise.all(subscriptions.map((subscription) => subscription.unwrap()));
    await store
      .dispatch(
        dashboardApi.endpoints.relink.initiate({
          sessionId: "session-1",
          sessionRelinkRequest: { issueIdentifier: "ENG-215" },
        }),
      )
      .unwrap();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests.filter((url) => url.includes("/api/sessions?")).length).toBe(2);
    expect(requests.filter((url) => url.includes("/api/issues/usage")).length).toBe(2);
    expect(requests.filter((url) => url.includes("/api/linear/status")).length).toBe(2);
    expect(relinkBody).toEqual({ issueIdentifier: "ENG-215" });
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  test("rescan and cost recalculation refresh the subscribed timeline", async () => {
    const store = createAppStore();
    const timeline = store.dispatch(dashboardApi.endpoints.timeline.initiate({ range: "12h" }));
    await timeline.unwrap();
    await store.dispatch(dashboardApi.endpoints.rescan.initiate()).unwrap();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await store.dispatch(dashboardApi.endpoints.recalculateCosts.initiate()).unwrap();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests.filter((url) => url.includes("/api/usage/timeline")).length).toBe(3);
    timeline.unsubscribe();
  });

  test("phase assignment, replacement, and clear refresh all phase-dependent reads", async () => {
    const store = createAppStore();
    const subscriptions = [
      store.dispatch(dashboardApi.endpoints.list.initiate({ limit: 20, offset: 0 })),
      store.dispatch(dashboardApi.endpoints.detail.initiate({ sessionId: "session-1" })),
      store.dispatch(dashboardApi.endpoints.listIssueUsage.initiate({ limit: 20, offset: 0 })),
      store.dispatch(dashboardApi.endpoints.getIssueUsage.initiate({ issueId: "issue-1" })),
      store.dispatch(dashboardApi.endpoints.timeline.initiate({ range: "12h" })),
      store.dispatch(
        dashboardApi.endpoints.timeline.initiate({ range: "24h", sessionPhase: "proposal" }),
      ),
    ];
    await Promise.all(subscriptions.map((subscription) => subscription.unwrap()));

    const counts = () => ({
      sessions: requests.filter((url) => url.includes("/api/sessions?")).length,
      sessionDetail: requests.filter((url) => url.endsWith("/api/sessions/session-1")).length,
      issueUsage: requests.filter((url) => url.includes("/api/issues/usage?")).length,
      issueDetail: requests.filter((url) => url.includes("/api/issues/issue-1/usage")).length,
      timelines: requests.filter((url) => url.includes("/api/usage/timeline")).length,
    });
    const initial = counts();
    expect(initial).toEqual({
      sessions: 1,
      sessionDetail: 1,
      issueUsage: 1,
      issueDetail: 1,
      timelines: 2,
    });

    for (const phase of ["proposal", "apply", null] as const) {
      await store
        .dispatch(
          dashboardApi.endpoints.setPhase.initiate({
            sessionId: "session-1",
            sessionPhaseRequest: { phase },
          }),
        )
        .unwrap();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const next = counts();
      expect(next).toEqual({
        sessions: initial.sessions + 1,
        sessionDetail: initial.sessionDetail + 1,
        issueUsage: initial.issueUsage + 1,
        issueDetail: initial.issueDetail + 1,
        timelines: initial.timelines + 2,
      });
      initial.sessions = next.sessions;
      initial.sessionDetail = next.sessionDetail;
      initial.issueUsage = next.issueUsage;
      initial.issueDetail = next.issueDetail;
      initial.timelines = next.timelines;
    }
    expect(phaseBodies).toEqual([{ phase: "proposal" }, { phase: "apply" }, { phase: null }]);
    expect(requests.some((url) => url.includes("/api/costs/status"))).toBe(false);
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });
});
