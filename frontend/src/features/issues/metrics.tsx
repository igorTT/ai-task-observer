import type { UsageMetricsResponse } from "@/api/generated/api";
import { Badge } from "@/components/ui/badge";
import { formatCode, formatDecimalCount, formatNullableCount, formatUsd } from "@/lib/formatters";

const fields: Array<[keyof UsageMetricsResponse, string, (value: string | null) => string]> = [
  ["sessionCount", "Sessions", formatNullableCount],
  ["developerTurns", "Developer turns", formatNullableCount],
  ["inputTokens", "Input tokens", formatNullableCount],
  ["cachedInputTokens", "Cached input (included)", formatNullableCount],
  ["outputTokens", "Output tokens", formatNullableCount],
  ["totalTokens", "Total tokens", formatNullableCount],
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
  const warnings = [...metrics.anomalyCodes, ...metrics.pricingGapCodes];
  return (
    <div className="flex flex-wrap gap-2">
      <Badge className={metrics.tokenComplete ? "text-emerald-700" : "text-amber-800"}>
        {metrics.tokenComplete ? "Tokens complete" : "Partial tokens"}
      </Badge>
      <Badge className={metrics.costComplete ? "text-emerald-700" : "text-amber-800"}>
        {metrics.costComplete ? "Cost complete" : "Partial estimate"}
      </Badge>
      {warnings.map((code) => (
        <Badge className="text-amber-800" key={code}>
          {formatCode(code)}
        </Badge>
      ))}
    </div>
  );
}

export function CompactMetrics({ metrics }: { metrics: UsageMetricsResponse }) {
  return (
    <span>
      {formatDecimalCount(metrics.sessionCount)} sessions ·{" "}
      {formatNullableCount(metrics.totalTokens)} tokens · {formatUsd(metrics.estimatedCostUsd)}
    </span>
  );
}
