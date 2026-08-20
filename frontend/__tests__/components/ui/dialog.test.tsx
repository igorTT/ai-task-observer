import { expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/dialog";

test("confirmation dialog has named controls and reports cancellation", () => {
  let closed = false;
  const view = render(
    <ConfirmDialog
      open
      title="Replace issue?"
      description="Confirm replacement"
      confirmLabel="Confirm"
      onOpenChange={() => {}}
      onConfirm={() => {}}
    />,
  );
  expect(view.getByRole("dialog", { name: "Replace issue?" })).toBeTruthy();
  view.rerender(
    <ConfirmDialog
      open
      title="Replace issue?"
      description="Confirm replacement"
      confirmLabel="Confirm"
      onOpenChange={(open) => {
        closed = !open;
      }}
      onConfirm={() => {}}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(closed).toBe(true);
});
