export const UNKNOWN_USAGE_WARNING_DESCRIPTION =
  "Usage data contains a warning that this version of the app does not recognize.";

const descriptions: Readonly<Record<string, string>> = {
  partial_tokens: "Some token counts are missing or could not be calculated.",
  partial_estimate: "This estimate includes only the usage with available pricing data.",
  cost_unavailable:
    "A cost estimate cannot be calculated from the available usage and pricing data.",
  last_usage_mismatch:
    "The reported last-usage counters do not match the calculated token difference.",
  counter_reset: "The cumulative token counters reset during this session.",
  reset_without_last_usage:
    "The token counters reset without complete last-usage counters to recover the interval.",
  negative_counter: "A reported token counter was negative and was excluded.",
  cached_exceeds_input: "Cached input tokens exceeded total input tokens and were excluded.",
  missing_counter: "One or more required token counters were missing.",
  legacy_aggregate: "These token totals came from a legacy aggregate with limited detail.",
  unknown_model: "The model is not present in the pricing catalog.",
  unknown_observation_time: "The usage time is unavailable, so no pricing period can be selected.",
  price_period_gap: "No catalog price covers the time when this usage occurred.",
  uncached_input_unavailable: "Uncached input tokens are unavailable for this cost calculation.",
  cached_input_unavailable: "Cached input tokens are unavailable for this cost calculation.",
  output_unavailable: "Output tokens are unavailable for this cost calculation.",
  uncovered_generation: "Some usage has not been processed by the current cost calculation.",
};

export function getUsageWarningDescription(code: string): string {
  return descriptions[code] ?? UNKNOWN_USAGE_WARNING_DESCRIPTION;
}
