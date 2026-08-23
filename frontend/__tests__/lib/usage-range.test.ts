import { describe, expect, test } from "bun:test";

import {
  canonicalUsageSearch,
  parseUsageRange,
  usageRangeFromSearch,
  usageSearchForRange,
} from "@/lib/usage-range";

describe("usage range URL state", () => {
  test("canonicalizes absent, malformed, and default values to 12 hours", () => {
    expect(parseUsageRange(undefined)).toBe("12h");
    expect(parseUsageRange("7d")).toBe("12h");
    expect(usageRangeFromSearch("?range=malformed")).toBe("12h");
    expect(canonicalUsageSearch("?page=2&range=12h")).toBe("page=2");
    expect(canonicalUsageSearch("?range=7d")).toBe("");
  });

  test("writes only non-default 24-hour state and preserves other query values", () => {
    expect(usageSearchForRange("?page=2", "24h")).toBe("page=2&range=24h");
    expect(usageSearchForRange("?page=2&range=24h", "12h")).toBe("page=2");
  });
});
