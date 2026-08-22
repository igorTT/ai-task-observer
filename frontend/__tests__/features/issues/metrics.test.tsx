import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import type { UsageMetricsResponse } from "@/api/generated/api";
import { CompactMetrics, MetricGrid, MetricState } from "@/features/issues/metrics";

const metrics: UsageMetricsResponse = {
  sessionCount: "12345",
  developerTurns: "1001",
  inputTokens: "1700000",
  cachedInputTokens: "128",
  outputTokens: "990673",
  totalTokens: "12700000",
  estimatedCostUsd: "12.5",
  tokenComplete: false,
  costComplete: true,
  anomalyCodes: [],
  pricingGapCodes: [],
};

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

  test("keeps compact summaries and state markers honest", () => {
    const view = render(
      <>
        <CompactMetrics metrics={metrics} />
        <MetricState metrics={{ ...metrics, totalTokens: null, estimatedCostUsd: null }} />
      </>,
    );

    expect(view.getByText("12,345 sessions · 12.7m tokens · $12.50")).toBeTruthy();
    expect(view.getByText("Partial tokens")).toBeTruthy();
    expect(view.getByText("Cost complete")).toBeTruthy();
  });
});
