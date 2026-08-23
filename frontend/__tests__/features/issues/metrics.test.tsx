import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";

import type { UsageMetricsResponse } from "@/api/generated/api";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompactMetrics, MetricGrid, MetricState } from "@/features/issues/metrics";
import { UNKNOWN_USAGE_WARNING_DESCRIPTION } from "@/features/issues/usage-warning-descriptions";

const metrics: UsageMetricsResponse = {
  sessionCount: "12345",
  developerTurns: "1001",
  inputTokens: "1700000",
  cachedInputTokens: "128",
  outputTokens: "990673",
  totalTokens: "12700000",
  estimatedCostUsd: "12.5",
  tokenComplete: true,
  costComplete: true,
  anomalyCodes: [],
  pricingGapCodes: [],
};

function renderState(overrides: Partial<UsageMetricsResponse> = {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <MetricState metrics={{ ...metrics, ...overrides }} />
    </TooltipProvider>,
  );
}

describe("usage metric presentation", () => {
  test("uses compact token labels and exact non-token counts", () => {
    const view = render(<MetricGrid metrics={metrics} />);

    expect(view.getByText("1.7m")).toBeTruthy();
    expect(view.getByText("128")).toBeTruthy();
    expect(view.getByText("990k")).toBeTruthy();
    expect(view.getByText("12.7m")).toBeTruthy();
    expect(view.getByText("12,345")).toBeTruthy();
    expect(view.getByText("1,001")).toBeTruthy();
    expect(view.getByText("Cached input (included)")).toBeTruthy();
  });

  test("keeps healthy metric state quiet while preserving known values", () => {
    const state = renderState();
    expect(state.container.innerHTML).toBe("");

    const summary = render(<CompactMetrics metrics={metrics} />);
    expect(summary.getByText("12,345 sessions · 12.7m tokens · $12.50")).toBeTruthy();
  });

  test("renders the correct synthetic warnings for incomplete metrics", () => {
    const partial = renderState({ tokenComplete: false, costComplete: false });
    expect(partial.getByText("Partial tokens")).toBeTruthy();
    expect(partial.getByText("Partial estimate")).toBeTruthy();

    partial.unmount();
    const unavailable = renderState({ costComplete: false, estimatedCostUsd: null });
    expect(unavailable.getByText("Cost unavailable")).toBeTruthy();
  });

  test("de-duplicates warning codes in deterministic order and keeps them focusable", () => {
    const view = renderState({
      tokenComplete: false,
      anomalyCodes: ["counter_reset", "counter_reset"],
      pricingGapCodes: ["unknown_model", "counter_reset"],
    });
    const labels = [...view.container.querySelectorAll("[tabindex='0']")].map(
      (element) => element.textContent,
    );

    expect(labels).toEqual(["Partial tokens", "Counter Reset", "Unknown Model"]);
  });

  test("associates each known and unknown warning with its own explanation", async () => {
    const view = renderState({ anomalyCodes: ["counter_reset", "future_<opaque>"] });
    const reset = view.getByText("Counter Reset");
    const unknown = view.getByText("Future Opaque");

    fireEvent.focus(reset);
    await waitFor(() => expect(view.getByRole("tooltip").textContent).toContain("counters reset"));
    fireEvent.blur(reset);

    fireEvent.focus(unknown);
    await waitFor(() =>
      expect(view.getByRole("tooltip").textContent).toBe(UNKNOWN_USAGE_WARNING_DESCRIPTION),
    );
    expect(view.getByRole("tooltip").textContent).not.toContain("opaque");
  });
});
