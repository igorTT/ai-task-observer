import { describe, expect, test } from "bun:test";

import { cn } from "@/lib/utils";

describe("application-local alias", () => {
  test("resolves frontend source through @/", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
