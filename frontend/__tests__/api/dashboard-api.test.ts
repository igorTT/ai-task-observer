import { beforeEach, describe, expect, mock, test } from "bun:test";
import { dashboardApi } from "@/api/dashboard-api";
import { createAppStore } from "@/app/store";

describe("dashboard API cache tags", () => {
  let requests: string[];
  let relinkBody: unknown;

  beforeEach(() => {
    requests = [];
    relinkBody = undefined;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      const url = input instanceof Request ? input.url : String(input);
      requests.push(url);
      if (url.includes("/api/sessions/session-1/relink")) {
        if (input instanceof Request) relinkBody = await input.clone().json();
        return Response.json({ attribution: {} });
      }
      if (url.includes("/api/sessions"))
        return Response.json({ items: [], total: 0, limit: 20, offset: 0 });
      if (url.includes("/api/issues/usage"))
        return Response.json({ items: [], total: "0", limit: 20, offset: 0 });
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
});
