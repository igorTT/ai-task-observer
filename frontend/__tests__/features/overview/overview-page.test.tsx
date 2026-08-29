import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router-dom";

import { App } from "@/app/app";
import { routes } from "@/app/route-config";
import { createAppStore } from "@/app/store";

let originalFetch: typeof fetch;
let timelineRequests: string[];
let failTimeline = false;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  timelineRequests = [];
  failTimeline = false;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    await Promise.resolve();
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/api/usage/timeline")) {
      timelineRequests.push(url);
      if (failTimeline)
        return Response.json(
          { error: { code: "internal_error", message: "private" } },
          { status: 500 },
        );
      const parameters = new URL(url).searchParams;
      return Response.json(
        timeline(
          parameters.get("range") === "24h" ? "24h" : "12h",
          parameters.get("sessionPhase") ?? "all",
        ),
      );
    }
    if (url.includes("/api/imports/status"))
      return Response.json({ roots: [], checkpoints: [], acceptingWork: true });
    if (url.includes("/api/linear/status"))
      return Response.json({
        configured: false,
        state: "unconfigured",
        acceptingWork: false,
        counts: { unlinked: 0, unconfigured: 0, pending: 0, linked: 0, not_found: 0, error: 0 },
      });
    if (url.includes("/api/costs/status"))
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
    return Response.json({ items: [], total: "0", limit: 20, offset: 0 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("recent usage overview", () => {
  test("loads 12 hours by default and updates counters and charts from one response", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview"] });
    render(<App router={router} store={createAppStore()} />);

    expect(await screen.findByText("13k")).toBeTruthy();
    expect(screen.getByText("$0.12")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Token consumption" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Estimated cost" })).toBeTruthy();
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Current session phase" }).value,
    ).toBe("all");
    expect(timelineRequests).toHaveLength(1);
    expect(timelineRequests[0]).toContain("range=12h");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Recent usage range" }),
      "24h",
    );
    await waitFor(() => expect(router.state.location.search).toBe("?range=24h"));
    expect(await screen.findByText("26k")).toBeTruthy();
    expect(screen.getByText("$0.24")).toBeTruthy();
    expect(timelineRequests.some((url) => url.includes("range=24h"))).toBe(true);
  });

  test("filters all overview values by Proposal and explains current assignment semantics", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview"] });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("13k");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Current session phase" }),
      "proposal",
    );

    await waitFor(() => expect(router.state.location.search).toBe("?phase=proposal"));
    expect(await screen.findByText("39k")).toBeTruthy();
    expect(screen.getByText("$0.36")).toBeTruthy();
    expect(
      screen.getByText(
        "Showing usage from sessions currently assigned to Proposal. This is the current session classification, not phase-at-event history.",
      ),
    ).toBeTruthy();
    expect(timelineRequests.some((url) => url.includes("sessionPhase=proposal"))).toBe(true);
  });

  test("supports Unassigned separately from explicit other and restores phase through history", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview"] });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("13k");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Current session phase" }),
      "unassigned",
    );
    await waitFor(() => expect(router.state.location.search).toBe("?phase=unassigned"));
    expect(await screen.findByText("52k")).toBeTruthy();
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Current session phase" }).value,
    ).toBe("unassigned");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Current session phase" }),
      "other",
    );
    await waitFor(() => expect(router.state.location.search).toBe("?phase=other"));
    expect(timelineRequests.some((url) => url.includes("sessionPhase=other"))).toBe(true);

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(router.state.location.search).toBe("?phase=unassigned"));
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Current session phase" }).value,
    ).toBe("unassigned");
  });

  test("keeps the range selector available and shows a sanitized retry after failure", async () => {
    failTimeline = true;
    const router = createMemoryRouter(routes, { initialEntries: ["/overview?range=24h"] });
    render(<App router={router} store={createAppStore()} />);

    expect(
      await screen.findByRole("heading", { name: "Unable to load recent usage" }),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Recent usage range" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Current session phase" })).toBeTruthy();
    expect(screen.queryByText("private")).toBeNull();
    failTimeline = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("26k")).toBeTruthy();
  });

  test("exposes chart descriptions and newest-first exact bucket rows to assistive technology", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview"] });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("13k");
    const figures = screen.getAllByRole("figure");
    expect(figures).toHaveLength(2);
    figures.forEach((figure) => {
      expect(figure.getAttribute("aria-labelledby")).toBeTruthy();
      expect(figure.getAttribute("aria-describedby")).toBeTruthy();
    });
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Interval", "Tokens", "Estimated cost"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]?.textContent).toContain("3,000");
    expect(rows[1]?.textContent).toContain("10,000");
    expect(rows[2]?.textContent).toContain("0 (incomplete)");
    expect(table.textContent).toContain("$0.08");
    expect(table.textContent).not.toContain("Completeness");
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Recent usage range" }).value,
    ).toBe("12h");
  });

  test("keeps incomplete and unavailable states inline with exact metric values", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview"] });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("13k");
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    const cells = within(rows[2] as HTMLElement).getAllByRole("cell");

    expect(cells[0]?.textContent).toContain("0 (incomplete)");
    expect(cells[1]?.textContent).toContain("Unavailable (incomplete)");
  });

  test("normalizes invalid range URLs and restores the default through browser history", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/overview?range=invalid"] });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("13k");
    await waitFor(() => expect(router.state.location.search).toBe(""));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Recent usage range" }),
      "24h",
    );
    await waitFor(() => expect(router.state.location.search).toBe("?range=24h"));
    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Recent usage range" }).value,
    ).toBe("12h");
  });

  test("normalizes invalid phase URLs without issuing an unsupported request", async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/overview?range=24h&page=2&phase=invalid"],
    });
    render(<App router={router} store={createAppStore()} />);

    await screen.findByText("26k");
    await waitFor(() => expect(router.state.location.search).toBe("?range=24h&page=2"));
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", { name: "Current session phase" }).value,
    ).toBe("all");
    expect(timelineRequests.every((url) => !url.includes("sessionPhase=invalid"))).toBe(true);
  });
});

function timeline(range: "12h" | "24h", phase: string) {
  const rangeMultiplier = range === "12h" ? 1 : 2;
  const phaseMultiplier = phase === "proposal" ? 3 : phase === "unassigned" ? 4 : 1;
  const multiplier = rangeMultiplier * phaseMultiplier;
  return {
    range,
    bucketUnit: "hour",
    startAt: "2026-08-22T00:00:00.000Z",
    endAt: "2026-08-22T12:00:00.000Z",
    sessionPhase: phase === "all" ? null : phase,
    totals: {
      totalTokens: String(13_000 * multiplier),
      estimatedCostUsd: `0.${12 * multiplier}`,
      tokenComplete: true,
      costComplete: true,
      completeness: { token: "complete", cost: "complete" },
      warnings: [],
    },
    buckets: [
      {
        startAt: "2026-08-22T09:00:00.000Z",
        endAt: "2026-08-22T10:00:00.000Z",
        totalTokens: "0",
        estimatedCostUsd: null,
        tokenComplete: false,
        costComplete: false,
        completeness: { token: "partial", cost: "unavailable" },
        warnings: ["uncovered_generation"],
      },
      {
        startAt: "2026-08-22T10:00:00.000Z",
        endAt: "2026-08-22T11:00:00.000Z",
        totalTokens: String(10_000 * multiplier),
        estimatedCostUsd: `0.0${8 * multiplier}`,
        tokenComplete: true,
        costComplete: true,
        completeness: { token: "complete", cost: "complete" },
        warnings: [],
      },
      {
        startAt: "2026-08-22T11:00:00.000Z",
        endAt: "2026-08-22T12:00:00.000Z",
        totalTokens: String(3_000 * multiplier),
        estimatedCostUsd: `0.0${4 * multiplier}`,
        tokenComplete: true,
        costComplete: true,
        completeness: { token: "complete", cost: "complete" },
        warnings: [],
      },
    ],
    unknownTimeObservationCount: "0",
    costCoverage: "current",
    latestCompletedCostGeneration: null,
  };
}
