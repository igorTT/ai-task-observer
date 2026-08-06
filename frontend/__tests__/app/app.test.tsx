import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";

import { App } from "@/app/app";
import { routes } from "@/app/route-config";
import { createAppStore } from "@/app/store";
import { useShellStore } from "@/stores/shell-store";

describe("application shell", () => {
  test("renders the initial route with the Redux provider", () => {
    const view = render(
      <App
        router={createMemoryRouter(routes, { initialEntries: ["/"] })}
        store={createAppStore()}
      />,
    );
    expect(view.getByRole("heading", { name: /understand the work/iu })).toBeTruthy();
    expect(view.getByText("AI Task Observer")).toBeTruthy();
  });

  test("keeps shell display preference in Zustand", () => {
    useShellStore.setState({ compactMode: false });
    const view = render(<App router={createMemoryRouter(routes)} />);
    fireEvent.click(view.getByRole("button", { name: "Compact view" }));
    expect(useShellStore.getState().compactMode).toBe(true);
    expect(view.getByRole("button", { name: "Comfortable view" })).toBeTruthy();
  });
});
