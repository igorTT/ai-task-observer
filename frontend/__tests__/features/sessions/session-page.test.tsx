import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";

import type { SessionResponse } from "@/api/generated/api";
import { createAppStore } from "@/app/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionCard } from "@/features/sessions/session-page";

const session: SessionResponse = {
  sessionId: "session-cost",
  currentTitle: "Cost state",
  developerTurns: "1",
  inputTokens: "100",
  cachedInputTokens: "20",
  uncachedInputTokens: "80",
  outputTokens: "10",
  totalTokens: "110",
  estimatedCostUsd: "12.5",
  costComplete: true,
  pricingGapCodes: [],
  usageObserved: true,
  tokenCompleteness: {
    input: true,
    cachedInput: true,
    uncachedInput: true,
    output: true,
    total: true,
  },
  usageAnomalies: [],
  importState: "ready",
  attribution: {
    status: "unlinked",
    relinkRequired: false,
    synchronizationState: "unlinked",
  },
};

function renderSession(overrides: Partial<SessionResponse> = {}) {
  return render(
    <Provider store={createAppStore()}>
      <TooltipProvider delayDuration={0}>
        <SessionCard session={{ ...session, ...overrides }} linearReady={false} />
      </TooltipProvider>
    </Provider>,
  );
}

describe("session cost presentation", () => {
  test("renders a complete estimate and never labels it partial", () => {
    const view = renderSession();

    expect(view.getByText("$12.50")).toBeTruthy();
    expect(view.queryByText("Cost complete")).toBeNull();
    expect(view.queryByText("Tokens complete")).toBeNull();
    expect(view.queryByText("Partial estimate")).toBeNull();
  });

  test("renders known partial cost and independently explained pricing gaps", async () => {
    const view = renderSession({
      estimatedCostUsd: "0.25",
      costComplete: false,
      pricingGapCodes: ["cached_input_unavailable", "unknown_model"],
    });

    expect(view.getByText("$0.25")).toBeTruthy();
    expect(view.getByText("Partial estimate")).toBeTruthy();
    expect(view.getByText("Cached Input Unavailable")).toBeTruthy();
    expect(view.getByText("Unknown Model")).toBeTruthy();

    const partial = view.getByText("Partial estimate");
    const model = view.getByText("Unknown Model");
    expect(partial.getAttribute("tabindex")).toBe("0");
    expect(model.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(model);
    await waitFor(() => expect(view.getByRole("tooltip").textContent).toContain("pricing catalog"));
  });

  test("renders unavailable cost distinctly from numeric zero", () => {
    const unavailable = renderSession({ estimatedCostUsd: null, costComplete: false });
    expect(unavailable.getByText("Unavailable")).toBeTruthy();
    expect(unavailable.getByText("Cost unavailable")).toBeTruthy();
    expect(unavailable.queryByText("$0.00")).toBeNull();

    unavailable.unmount();
    const zero = renderSession({ estimatedCostUsd: "0", costComplete: true });
    expect(zero.getByText("$0.00")).toBeTruthy();
    expect(zero.queryByText("Cost complete")).toBeNull();
  });

  test("preserves a known estimate when token accounting is partial", () => {
    const view = renderSession({
      tokenCompleteness: { ...session.tokenCompleteness, cachedInput: false },
    });

    expect(view.getByText("$12.50")).toBeTruthy();
    expect(view.getByText("Partial tokens")).toBeTruthy();
  });
});
