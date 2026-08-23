import type { UsageMetricsResponse } from "@/api/generated/api";
import { WarningBadge } from "@/components/ui/warning-badge";
import { getUsageWarningDescription } from "@/features/issues/usage-warning-descriptions";
import {
  formatCode,
  formatCompactTokenCount,
  formatDecimalCount,
  formatNullableCount,
  formatUsd,
} from "@/lib/formatters";

const fields: Array<[keyof UsageMetricsResponse, string, (value: string | null) => string]> = [
  ["sessionCount", "Sessions", formatNullableCount],
  ["developerTurns", "Developer turns", formatNullableCount],
  ["inputTokens", "Input tokens", formatCompactTokenCount],
  ["cachedInputTokens", "Cached input (included)", formatCompactTokenCount],
  ["outputTokens", "Output tokens", formatCompactTokenCount],
  ["totalTokens", "Total tokens", formatCompactTokenCount],
  ["estimatedCostUsd", "Estimated cost", formatUsd],
];

export function MetricGrid({ metrics }: { metrics: UsageMetricsResponse }) {
  return (
    <dl className="metric-grid">
      {fields.map(([key, label, formatter]) => (
        <div key={key} className="metric">
          <dt>{label}</dt>
          <dd>{formatter(metrics[key] as string | null)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricState({ metrics }: { metrics: UsageMetricsResponse }) {
  const warnings = [
    ...(metrics.tokenComplete ? [] : ["partial_tokens"]),
    ...(metrics.costComplete
      ? []
      : [metrics.estimatedCostUsd === null ? "cost_unavailable" : "partial_estimate"]),
    ...metrics.anomalyCodes,
    ...metrics.pricingGapCodes,
  ];
  const distinctWarnings = [...new Set(warnings)];
  if (distinctWarnings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {distinctWarnings.map((code) => (
        <WarningBadge
          key={code}
          label={warningLabel(code)}
          description={getUsageWarningDescription(code)}
        />
      ))}
    </div>
  );
}

function warningLabel(code: string): string {
  if (code === "partial_tokens") return "Partial tokens";
  if (code === "partial_estimate") return "Partial estimate";
  if (code === "cost_unavailable") return "Cost unavailable";
  return formatCode(code);
}

export function CompactMetrics({ metrics }: { metrics: UsageMetricsResponse }) {
  return (
    <span>
      {formatDecimalCount(metrics.sessionCount)} sessions ·{" "}
      {formatCompactTokenCount(metrics.totalTokens)} tokens · {formatUsd(metrics.estimatedCostUsd)}
    </span>
  );
}
