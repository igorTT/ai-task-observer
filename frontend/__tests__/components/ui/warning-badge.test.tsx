import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { WarningBadge } from "@/components/ui/warning-badge";

function renderBadge() {
  return render(
    <TooltipProvider delayDuration={0}>
      <WarningBadge label="Partial tokens" description="Some token counts are missing." />
    </TooltipProvider>,
  );
}

describe("WarningBadge", () => {
  test("shows its label and explains the warning on pointer hover", async () => {
    const view = renderBadge();
    const badge = view.getByText("Partial tokens");

    fireEvent.pointerMove(badge, { pointerType: "mouse" });

    await waitFor(() => expect(view.getByRole("tooltip").textContent).toContain("missing"));
  });

  test("is focusable and explains the warning on keyboard focus", async () => {
    const view = renderBadge();
    const badge = view.getByText("Partial tokens");

    expect(badge.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(badge);

    await waitFor(() => expect(view.getByRole("tooltip").textContent).toContain("missing"));
  });
});
