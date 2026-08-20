import { describe, expect, test } from "bun:test";
import { normalizeApiError } from "@/lib/api-error";
import {
  formatCode,
  formatDecimalCount,
  formatDuration,
  formatNullableCount,
  formatUsd,
  formatUtcDate,
} from "@/lib/formatters";
import { pageOffset, parsePage, totalPages } from "@/lib/pagination";

describe("honest formatting", () => {
  test("groups exact integers beyond Number.MAX_SAFE_INTEGER", () => {
    expect(formatDecimalCount("900719925474099312345")).toBe("900,719,925,474,099,312,345");
    expect(formatNullableCount(null)).toBe("Unavailable");
    expect(formatNullableCount("0")).toBe("0");
  });

  test("formats decimal USD without binary floating point", () => {
    expect(formatUsd("9007199254740993.125")).toBe("$9,007,199,254,740,993.13");
    expect(formatUsd(null)).toBe("Unavailable");
  });

  test("handles UTC, unknown dates, duration, and sanitized codes", () => {
    expect(formatUtcDate(null)).toBe("Unknown time");
    expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T01:05:00Z")).toBe("1h 5m");
    expect(formatCode("pricing_gap<script>")).toBe("Pricing Gapscript");
  });
});

describe("pagination and safe errors", () => {
  test("normalizes missing, malformed, negative, and unsafe pages", () => {
    for (const value of [null, "", "0", "-1", "1.5", "no", "999999999999999999999"])
      expect(parsePage(value)).toBe(1);
    expect(pageOffset(parsePage("3"))).toBe(40);
    expect(totalPages("41")).toBe(3);
  });

  test("maps documented and unknown failures without raw content", () => {
    expect(
      normalizeApiError({ status: 404, data: { error: { code: "NOT_FOUND", message: "raw" } } })
        .notFound,
    ).toBe(true);
    expect(normalizeApiError({ status: 500, data: { secret: "do not expose" } }).message).toBe(
      "The request could not be completed. Please try again.",
    );
  });
});
