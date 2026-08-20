import { describe, expect, mock, test } from "bun:test";

import {
  generatedApi,
  type GetHealthApiResponse,
  type GetIssueUsageApiResponse,
} from "@/api/generated/api";
import { createAppStore } from "@/app/store";

describe("generated health client", () => {
  test("matches the backend health route and response contract", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      requestedUrl = input instanceof Request ? input.url : String(input);
      const response: GetHealthApiResponse = { status: "healthy" };
      return Promise.resolve(
        new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    try {
      const result = await createAppStore()
        .dispatch(generatedApi.endpoints.getHealth.initiate())
        .unwrap();
      expect(requestedUrl.endsWith("/api/health")).toBe(true);
      expect(result).toEqual({ status: "healthy" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("generated issue usage client", () => {
  test("preserves nullable metrics, decimal strings, null dates, and nested breakdowns", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      requestedUrl = input instanceof Request ? input.url : String(input);
      const response: GetIssueUsageApiResponse = {
        issue: { id: "issue-1", identifier: "ENG-1", title: "Issue", url: "https://test" },
        metrics: metrics({ cachedInputTokens: null, estimatedCostUsd: "0.15" }),
        latestCompletedCostGeneration: null,
        sessions: [
          {
            sessionId: "session-1",
            title: null,
            phase: "apply",
            importState: "ready",
            lastError: null,
            startedAt: null,
            endedAt: null,
            metrics: metrics(),
            models: [{ model: "unknown", observedModels: ["alias"], metrics: metrics() }],
          },
        ],
        models: [{ model: "unknown", observedModels: ["alias"], metrics: metrics() }],
        daily: [{ date: null, metrics: metrics() }],
      };
      return Promise.resolve(
        new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    try {
      const result = await createAppStore()
        .dispatch(generatedApi.endpoints.getIssueUsage.initiate({ issueId: "issue-1" }))
        .unwrap();
      expect(requestedUrl.endsWith("/api/issues/issue-1/usage")).toBe(true);
      expect(result.metrics.cachedInputTokens).toBeNull();
      expect(result.metrics.estimatedCostUsd).toBe("0.15");
      expect(result.daily[0]?.date).toBeNull();
      expect(result.sessions[0]?.models[0]?.model).toBe("unknown");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function metrics(overrides: Partial<GetIssueUsageApiResponse["metrics"]> = {}) {
  return {
    sessionCount: "1",
    developerTurns: "1",
    inputTokens: "10",
    cachedInputTokens: "2",
    outputTokens: "3",
    totalTokens: "13",
    estimatedCostUsd: "0.01",
    tokenComplete: true,
    costComplete: true,
    anomalyCodes: [],
    pricingGapCodes: [],
    ...overrides,
  };
}
