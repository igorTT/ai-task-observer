import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { createAppStore } from "@/app/store";
import { OperationsPanel } from "@/features/operations/operations-panel";

let originalFetch: typeof fetch;
let originalSetInterval: typeof window.setInterval;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalSetInterval = window.setInterval.bind(window);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  window.setInterval = originalSetInterval;
});

describe("operations panel", () => {
  test("explicitly refreshes all statuses and exposes aggregate pending state", async () => {
    const requests: string[] = [];
    const pendingRefreshes: { url: string; resolve: (response: Response) => void }[] = [];
    let holdRefresh = false;
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      requests.push(url);
      if (holdRefresh) {
        return new Promise<Response>((resolve) => pendingRefreshes.push({ url, resolve }));
      }
      return Promise.resolve(statusResponse(url));
    }) as unknown as typeof fetch;

    renderPanel();
    await waitFor(() => expect(statusRequests(requests)).toHaveLength(3));
    await userEvent.click(screen.getByRole("button", { name: /Operations/u }));

    const refresh = screen.getByRole<HTMLButtonElement>("button", {
      name: "Refresh operational status",
    });
    holdRefresh = true;
    await userEvent.click(refresh);

    await waitFor(() => expect(pendingRefreshes).toHaveLength(3));
    expect(refresh.disabled).toBe(true);
    expect(refresh.getAttribute("aria-busy")).toBe("true");
    expect(refresh.textContent).toContain("Refreshing");
    expect(statusRequests(requests)).toHaveLength(6);

    holdRefresh = false;
    pendingRefreshes.forEach(({ url, resolve }) => resolve(statusResponse(url)));
    await waitFor(() => expect(refresh.disabled).toBe(false));
    expect(refresh.getAttribute("aria-busy")).toBe("false");
  });

  test("does not install periodic status requests when a subsystem is active", async () => {
    const requests: string[] = [];
    let intervalCalls = 0;
    window.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
      if (args[1] === 1500) intervalCalls += 1;
      return originalSetInterval(...args);
    }) as typeof window.setInterval;
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      requests.push(url);
      return Promise.resolve(statusResponse(url, true));
    }) as unknown as typeof fetch;

    renderPanel();
    await waitFor(() => expect(statusRequests(requests)).toHaveLength(3));

    expect(intervalCalls).toBe(0);
    expect(statusRequests(requests)).toHaveLength(3);
  });

  test("counts every checkpoint but details only the checkpoints needing attention", async () => {
    const requests: string[] = [];
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      requests.push(url);
      return Promise.resolve(
        url.includes("/api/imports/status")
          ? importStatusWithCheckpointDiagnostics()
          : statusResponse(url),
      );
    }) as unknown as typeof fetch;

    renderPanel();
    await waitFor(() => expect(statusRequests(requests)).toHaveLength(3));
    await userEvent.click(screen.getByRole("button", { name: /Operations/u }));

    expect(screen.getByText("1/2 roots available · 5 checkpoints")).toBeTruthy();
    expect(screen.getByText("/missing: Session root unavailable")).toBeTruthy();
    expect(screen.queryByText(/healthy\.jsonl/u)).toBeNull();
    expect(screen.getByText(/stale\.jsonl: Stale at offset 10/u)).toBeTruthy();
    expect(screen.getByText(/unknown\.jsonl: Ready at offset 20 · 2 unknown/u)).toBeTruthy();
    expect(
      screen.getByText(/malformed\.jsonl: Ready at offset 30 · 0 unknown · 3 malformed/u),
    ).toBeTruthy();
    expect(
      screen.getByText(/error\.jsonl: Ready at offset 40.*Error: ingestion operation failed/u),
    ).toBeTruthy();
    expect(screen.queryByText(/private\/secret/u)).toBeNull();
  });
});

function renderPanel() {
  return render(
    <Provider store={createAppStore()}>
      <OperationsPanel />
    </Provider>,
  );
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function statusRequests(requests: string[]): string[] {
  return requests.filter((url) =>
    ["/api/imports/status", "/api/linear/status", "/api/costs/status"].some((path) =>
      url.includes(path),
    ),
  );
}

function statusResponse(url: string, active = false): Response {
  if (url.includes("/api/imports/status")) {
    return Response.json({
      roots: [{ root: "/sessions", available: true, discoveredFiles: 1 }],
      checkpoints: [],
      ...(active
        ? {
            currentRun: {
              runId: "run-active",
              trigger: "manual",
              state: "running",
              rootsDiscovered: 1,
              filesDiscovered: 1,
              filesImported: 0,
              sessionsImported: 0,
              warnings: 0,
              errors: 0,
            },
          }
        : {}),
      acceptingWork: true,
    });
  }
  if (url.includes("/api/linear/status")) {
    return Response.json({
      configured: true,
      state: "synchronized",
      acceptingWork: true,
      counts: { unlinked: 0, unconfigured: 0, pending: 0, linked: 1, not_found: 0, error: 0 },
    });
  }
  return Response.json({
    estimateKind: "configured_api_equivalent_usd",
    currentFactRevision: "1",
    coverage: "current",
    config: {
      schemaVersion: 1,
      catalogVersion: "1",
      contentHash: "hash",
      currency: "USD",
      tokenUnit: "1000000",
    },
    calculatorVersion: "1",
    acceptingWork: true,
  });
}

function importStatusWithCheckpointDiagnostics(): Response {
  return Response.json({
    roots: [
      { root: "/sessions", available: true, discoveredFiles: 5 },
      {
        root: "/missing",
        available: false,
        reason: "Session root unavailable",
        discoveredFiles: 0,
      },
    ],
    checkpoints: [
      {
        source: "healthy.jsonl",
        status: "ready",
        completeOffset: "0",
        unknownRecords: 0,
        malformedRecords: 0,
      },
      {
        source: "stale.jsonl",
        status: "stale",
        completeOffset: "10",
        unknownRecords: 0,
        malformedRecords: 0,
      },
      {
        source: "unknown.jsonl",
        status: "ready",
        completeOffset: "20",
        unknownRecords: 2,
        malformedRecords: 0,
      },
      {
        source: "malformed.jsonl",
        status: "ready",
        completeOffset: "30",
        unknownRecords: 0,
        malformedRecords: 3,
      },
      {
        source: "error.jsonl",
        status: "ready",
        completeOffset: "40",
        unknownRecords: 0,
        malformedRecords: 0,
        lastError: "Error: ingestion operation failed",
      },
    ],
    acceptingWork: true,
  });
}
