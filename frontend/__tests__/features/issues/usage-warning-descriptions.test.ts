import { describe, expect, test } from "bun:test";

import {
  getUsageWarningDescription,
  UNKNOWN_USAGE_WARNING_DESCRIPTION,
} from "@/features/issues/usage-warning-descriptions";

const knownCodes = [
  "partial_tokens",
  "partial_estimate",
  "cost_unavailable",
  "last_usage_mismatch",
  "counter_reset",
  "reset_without_last_usage",
  "negative_counter",
  "cached_exceeds_input",
  "missing_counter",
  "legacy_aggregate",
  "unknown_model",
  "unknown_observation_time",
  "price_period_gap",
  "uncached_input_unavailable",
  "cached_input_unavailable",
  "output_unavailable",
  "uncovered_generation",
] as const;

describe("usage warning descriptions", () => {
  test("provides a fixed tailored explanation for every known warning", () => {
    for (const code of knownCodes) {
      const description = getUsageWarningDescription(code);
      expect(description).not.toBe(UNKNOWN_USAGE_WARNING_DESCRIPTION);
      expect(description.length).toBeGreaterThan(20);
    }
  });

  test("uses a generic sanitized explanation for unknown and malformed codes", () => {
    const opaque = "future_warning_<private payload>";

    expect(getUsageWarningDescription(opaque)).toBe(UNKNOWN_USAGE_WARNING_DESCRIPTION);
    expect(getUsageWarningDescription(" ")).toBe(UNKNOWN_USAGE_WARNING_DESCRIPTION);
    expect(getUsageWarningDescription(opaque)).not.toContain(opaque);
    expect(getUsageWarningDescription(opaque)).not.toContain("private payload");
  });
});
