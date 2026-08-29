import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useImportStatusQuery, useUsageTimelineQuery } from "@/api/dashboard-api";
import type { UsageTimelineResponse } from "@/api/generated/api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading } from "@/features/issues/issue-list-page";
import { useCostCalculationStatusQuery } from "@/api/dashboard-api";
import { normalizeApiError } from "@/lib/api-error";
import {
  formatCode,
  formatCompactTokenCount,
  formatUsd,
  formatUsageInterval,
} from "@/lib/formatters";
import { useUsageRange, type UsageRange } from "@/lib/usage-range";
import {
  createUsageTimelinePresentation,
  type UsageTimelinePresentationBucket,
} from "@/features/overview/usage-timeline-presentation";
import { UsageRangeSelector } from "@/features/overview/range-selector";
import { UsagePhaseSelector } from "@/features/overview/phase-selector";
import {
  useUsagePhase,
  usagePhaseLabel,
  usagePhaseQueryValue,
  type UsagePhase,
} from "@/lib/usage-phase";

export function OverviewPage() {
  const [range, setRange] = useUsageRange();
  const [phase, setPhase] = useUsagePhase();
  const sessionPhase = usagePhaseQueryValue(phase);
  const query = useUsageTimelineQuery({
    range,
    ...(sessionPhase ? { sessionPhase } : {}),
  });
  const imports = useImportStatusQuery();
  const costs = useCostCalculationStatusQuery();

  return (
    <section className="space-y-6">
      <PageHeading title="Recent usage" refreshing={query.isFetching && Boolean(query.data)} />
      <div className="flex flex-wrap justify-end gap-3">
        <UsageRangeSelector value={range} onChange={setRange} />
        <UsagePhaseSelector value={phase} onChange={setPhase} />
      </div>
      {query.isLoading && !query.data ? (
        <OverviewLoading />
      ) : query.isError && !query.data ? (
        <OverviewError error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <OverviewContent
          timeline={query.data}
          range={range}
          phase={phase}
          refreshError={query.isError ? query.error : undefined}
          retry={() => void query.refetch()}
          importsActive={isActiveWork(imports.data?.currentRun?.state)}
          costsActive={Boolean(costs.data?.active || costs.data?.queued)}
        />
      ) : null}
    </section>
  );
}

function OverviewContent({
  timeline,
  range,
  phase,
  refreshError,
  retry,
  importsActive,
  costsActive,
}: {
  timeline: UsageTimelineResponse;
  range: UsageRange;
  phase: UsagePhase;
  refreshError?: unknown;
  retry: () => void;
  importsActive: boolean;
  costsActive: boolean;
}) {
  const presentation = createUsageTimelinePresentation(timeline);
  const duration = range === "12h" ? "12 hours" : "24 hours";
  const empty = timeline.totals.totalTokens === "0" && timeline.totals.estimatedCostUsd === "0";
  const generation = timeline.latestCompletedCostGeneration;
  return (
    <>
      {refreshError && (
        <Alert>
          <strong>Refresh failed.</strong> {normalizeApiError(refreshError).message}{" "}
          <Button className="ml-2" size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        </Alert>
      )}
      {(timeline.costCoverage !== "current" || importsActive || costsActive) && (
        <Alert>
          {importsActive || costsActive
            ? "New imported usage or cost work is in progress. This view will refresh when it completes."
            : timeline.costCoverage === "missing"
              ? "Estimated cost is unavailable because no completed cost generation is available."
              : "Estimated cost coverage is stale. Token usage remains independently available."}
          {generation && <span className="ml-2">Generation {generation.generationId}.</span>}
        </Alert>
      )}
      {phase !== "all" && (
        <p className="text-sm text-slate-600" aria-live="polite">
          Showing usage from sessions currently assigned to {usagePhaseLabel(phase)}. This is the
          current session classification, not phase-at-event history.
        </p>
      )}
      {timeline.unknownTimeObservationCount !== "0" && (
        <Alert>
          {formatDecimalCount(timeline.unknownTimeObservationCount)} committed observations have no
          source time and are not placed in the selected range.
        </Alert>
      )}
      <div className="overview-metric-grid">
        <OverviewMetric
          label="Total tokens"
          duration={duration}
          value={timeline.totals.totalTokens}
          display={formatCompactTokenCount(timeline.totals.totalTokens)}
          complete={timeline.totals.tokenComplete}
          completeness={timeline.totals.completeness.token}
        />
        <OverviewMetric
          label="Estimated cost"
          duration={duration}
          value={timeline.totals.estimatedCostUsd}
          display={formatUsd(timeline.totals.estimatedCostUsd)}
          complete={timeline.totals.costComplete}
          completeness={timeline.totals.completeness.cost}
        />
      </div>
      {empty && <Card role="status">No committed usage was observed in the selected range.</Card>}
      <div className="grid gap-6 xl:grid-cols-2">
        <UsageChart metric="tokens" range={range} buckets={presentation.buckets} />
        <UsageChart metric="cost" range={range} buckets={presentation.buckets} />
      </div>
      <AccessibleBucketTable range={range} buckets={presentation.buckets} />
      {timeline.totals.warnings.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Timeline warnings">
          {timeline.totals.warnings.map((warning) => (
            <Badge className="text-amber-800" key={warning}>
              {formatCode(warning)}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

function OverviewMetric({
  label,
  duration,
  value,
  display,
  complete,
  completeness,
}: {
  label: string;
  duration: string;
  value: string | null;
  display: string;
  complete: boolean;
  completeness: "complete" | "partial" | "unavailable";
}) {
  const state = complete
    ? value === "0"
      ? "Known zero"
      : "Complete"
    : value
      ? "Partial"
      : "Unavailable";
  return (
    <Card className="overview-metric-card">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums" title={value ?? "Unavailable"}>
        {display}
      </p>
      <p className="mt-1 text-sm text-slate-600">Last {duration}</p>
      <Badge className="mt-3" data-completeness={completeness}>
        {state}
      </Badge>
    </Card>
  );
}

function UsageChart({
  metric,
  range,
  buckets,
}: {
  metric: "tokens" | "cost";
  range: UsageRange;
  buckets: readonly UsageTimelinePresentationBucket[];
}) {
  const titleId = useId();
  const descriptionId = `${titleId}-description`;
  const title = metric === "tokens" ? "Token consumption" : "Estimated cost";
  const dataKey = metric === "tokens" ? "tokenPlotValue" : "costPlotValue";
  const completeKey = metric === "tokens" ? "tokenComplete" : "costComplete";
  const rangeLabel = range === "12h" ? "12 hours" : "24 hours";
  return (
    <Card className="usage-chart-card">
      <figure aria-labelledby={titleId} aria-describedby={descriptionId}>
        <figcaption>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p id={descriptionId} className="mt-1 text-sm text-slate-600">
            {rangeLabel} selected range. Bars are UTC-hour buckets with client-local interval
            labels; incomplete values are identified in the table below.
          </p>
        </figcaption>
        <div className="usage-chart mt-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              accessibilityLayer
              data={buckets}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" hide />
              <YAxis
                allowDecimals={metric === "cost"}
                tickFormatter={(value: number | string) =>
                  formatUsageAxisTick(Number(value), metric)
                }
              />
              <Tooltip
                content={(properties) => <ChartTooltip properties={properties} metric={metric} />}
                isAnimationActive={false}
              />
              <Bar
                dataKey={dataKey}
                name={metric === "tokens" ? "Tokens" : "Estimated cost"}
                isAnimationActive={false}
              >
                {buckets.map((bucket) => (
                  <Cell
                    key={bucket.index}
                    fill={bucket[completeKey] ? "#2563eb" : "#a16207"}
                    strokeDasharray={bucket[completeKey] ? undefined : "4 2"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </Card>
  );
}

function ChartTooltip({
  properties,
  metric,
}: {
  properties: {
    active?: boolean;
    payload?: readonly { payload?: UsageTimelinePresentationBucket }[];
  };
  metric: "tokens" | "cost";
}) {
  const bucket = properties.payload?.[0]?.payload;
  if (!properties.active || !bucket) return null;
  const value = metric === "tokens" ? bucket.totalTokens : bucket.estimatedCostUsd;
  const complete = metric === "tokens" ? bucket.tokenComplete : bucket.costComplete;
  return (
    <div className="rounded-lg border bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold">{bucket.intervalLabel}</p>
      <p className="mt-1">
        {metric === "tokens" ? "Tokens" : "Estimated cost"}: {tooltipValue(value, metric)}
      </p>
      <p className="mt-1">{complete ? "Complete" : value === null ? "Unavailable" : "Partial"}</p>
    </div>
  );
}

function AccessibleBucketTable({
  range,
  buckets,
}: {
  range: UsageRange;
  buckets: readonly UsageTimelinePresentationBucket[];
}) {
  const rows = [...buckets].reverse();

  return (
    <Card>
      <h2 className="text-lg font-semibold">Exact bucket data</h2>
      <p className="mt-1 text-sm text-slate-600">
        Accessible data for the selected {range === "12h" ? "12-hour" : "24-hour"} range.
      </p>
      <div className="table-scroll mt-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col">Interval</th>
              <th scope="col">Tokens</th>
              <th scope="col">Estimated cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bucket) => (
              <tr key={`${bucket.startAt}-${bucket.endAt}`}>
                <th scope="row" className="font-medium">
                  {formatUsageInterval(bucket.startAt, bucket.endAt)}
                </th>
                <td title={bucket.totalTokens ?? "Unavailable"}>
                  {exactValue(bucket.totalTokens, "tokens")}
                  {!bucket.tokenComplete && " (incomplete)"}
                </td>
                <td title={bucket.estimatedCostUsd ?? "Unavailable"}>
                  {exactValue(bucket.estimatedCostUsd, "cost")}
                  {!bucket.costComplete && " (incomplete)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OverviewLoading() {
  return (
    <div aria-label="Loading recent usage" className="space-y-4">
      <div className="overview-metric-grid">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  );
}

function OverviewError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Alert>
      <h2 className="font-semibold">Unable to load recent usage</h2>
      <p className="mt-1">{normalizeApiError(error).message}</p>
      <Button className="mt-3" variant="outline" onClick={retry}>
        Try again
      </Button>
    </Alert>
  );
}

function isActiveWork(state: string | undefined): boolean {
  return state === "queued" || state === "running" || state === "active";
}

function formatDecimalCount(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

function exactValue(value: string | null, metric: "tokens" | "cost"): string {
  if (value === null) return "Unavailable";
  return metric === "tokens" ? formatDecimalCount(value) : `$${value}`;
}

function tooltipValue(value: string | null, metric: "tokens" | "cost"): string {
  return metric === "tokens" ? formatCompactTokenCount(value) : exactValue(value, metric);
}

function formatUsageAxisTick(value: number, metric: "tokens" | "cost"): string {
  if (!Number.isFinite(value)) return "";

  const prefix = metric === "cost" ? "$" : "";
  const absolute = Math.abs(value);
  const units =
    metric === "tokens"
      ? [
          { threshold: 1_000_000_000, suffix: "b" },
          { threshold: 1_000_000, suffix: "m" },
          { threshold: 1_000, suffix: "k" },
        ]
      : [
          { threshold: 1_000_000, suffix: "m" },
          { threshold: 1_000, suffix: "k" },
        ];
  const unit = units.find(({ threshold }) => absolute >= threshold);

  if (unit) {
    return `${prefix}${trimUsageAxisScale(value / unit.threshold)}${unit.suffix}`;
  }

  if (metric === "cost" && absolute > 0 && absolute < 1) {
    return `${prefix}${value.toPrecision(2)}`;
  }

  return `${prefix}${new Intl.NumberFormat("en", {
    maximumFractionDigits: metric === "cost" ? 2 : 0,
  }).format(value)}`;
}

function trimUsageAxisScale(value: number): string {
  return Number(value.toFixed(1)).toString();
}
