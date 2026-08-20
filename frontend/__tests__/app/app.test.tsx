import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";

import { App } from "@/app/app";
import { routes } from "@/app/route-config";
import { createAppStore } from "@/app/store";

describe("application shell", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      await Promise.resolve();
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes("/api/issues/usage"))
        return Response.json({ items: [], total: "0", limit: 20, offset: 0 });
      if (url.includes("/api/imports/status"))
        return Response.json({ roots: [], checkpoints: [], acceptingWork: true });
      if (url.includes("/api/linear/status"))
        return Response.json({
          configured: false,
          state: "unconfigured",
          acceptingWork: false,
          counts: { unlinked: 0, unconfigured: 0, pending: 0, linked: 0, not_found: 0, error: 0 },
        });
      return Response.json({
        estimateKind: "configured_api_equivalent_usd",
        currentFactRevision: "1",
        coverage: "missing",
        config: {
          schemaVersion: 1,
          catalogVersion: "1",
          contentHash: "x",
          currency: "USD",
          tokenUnit: "1m",
        },
        calculatorVersion: "1",
        acceptingWork: true,
      });
    }) as unknown as typeof fetch;
  });

  test("renders the initial route with the Redux provider", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    const view = render(<App router={router} store={createAppStore()} />);
    expect(view.getByRole("heading", { name: "Issue usage" })).toBeTruthy();
    expect(view.getByText("AI Task Observer")).toBeTruthy();
    expect(view.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
    expect(view.getByRole("link", { name: "Issues" }).getAttribute("aria-current")).toBe("page");
    expect(view.getByRole("link", { name: "Sessions" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Toggle navigation" })).toBeNull();
    expect(router.state.location.pathname).toBe("/issues");
  });

  test("does not expose a density preference control", () => {
    const view = render(<App router={createMemoryRouter(routes)} />);
    expect(view.queryByRole("button", { name: "Compact density" })).toBeNull();
    expect(view.queryByRole("button", { name: "Comfortable density" })).toBeNull();
  });
});
