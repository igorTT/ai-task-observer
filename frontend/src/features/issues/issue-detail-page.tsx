import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useGetIssueUsageQuery } from "@/api/dashboard-api";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { MetricGrid, MetricState } from "@/features/issues/metrics";
import { PageHeading, PageLoading, RequestError } from "@/features/issues/issue-list-page";
import { normalizeApiError } from "@/lib/api-error";
import {
  formatCompactTokenCount,
  formatNullableCount,
  formatUtcDate,
  formatUsd,
} from "@/lib/formatters";

export function IssueDetailPage() {
  const issueId = useParams().issueId ?? "";
  const query = useGetIssueUsageQuery({ issueId });
  if (query.isLoading) return <PageLoading title="Issue detail" />;
  if (query.isError) {
    const error = normalizeApiError(query.error);
    return error.notFound ? (
      <Card>
        <h1>Issue usage not found</h1>
        <p className="mt-2 text-slate-600">This issue no longer has current linked usage.</p>
        <Link className="safe-link mt-4" to="/issues">
          Back to issue usage
        </Link>
      </Card>
    ) : (
      <RequestError error={query.error} retry={() => void query.refetch()} />
    );
  }
  if (!query.data) return null;
  const {
    issue,
    metrics,
    sessions,
    models,
    daily,
    latestCompletedCostGeneration: generation,
  } = query.data;
  return (
    <section className="space-y-6">
      <PageHeading title={issue.identifier} refreshing={query.isFetching} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{issue.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {generation
              ? `Cost generation ${generation.generationId} · ${formatUtcDate(generation.completedAt)}`
              : "No completed cost generation"}
          </p>
        </div>
        <a className="safe-link" href={issue.url} target="_blank" rel="noreferrer">
          Open in Linear <ExternalLink size={14} />
        </a>
      </div>
      <Card>
        <MetricGrid metrics={metrics} />
        <div className="mt-4">
          <MetricState metrics={metrics} />
        </div>
      </Card>
      <CollectionTable
        title="Contributing sessions"
        headers={["Session", "Phase", "Import", "Time", "Tokens", "Cost"]}
        rows={sessions.map((session) => [
          <div key="id">
            <strong>{session.title ?? "Untitled session"}</strong>
            <div className="mono">{session.sessionId}</div>
            <div className="mt-1 text-xs text-slate-500">
              Models:{" "}
              {session.models
                .map((model) => (model.model === "unknown" ? "Unknown model" : model.model))
                .join(", ") || "None"}
            </div>
            {session.lastError && <Alert className="mt-2">{session.lastError}</Alert>}
          </div>,
          session.phase ?? "No phase",
          session.importState,
          `${formatUtcDate(session.startedAt)} – ${formatUtcDate(session.endedAt)}`,
          formatCompactTokenCount(session.metrics.totalTokens),
          <div key="cost">
            {formatUsd(session.metrics.estimatedCostUsd)}
            <div className="mt-2">
              <MetricState metrics={session.metrics} />
            </div>
          </div>,
        ])}
      />
      <CollectionTable
        title="Models"
        headers={["Model", "Observed names", "Tokens", "Cost"]}
        rows={models.map((model) => [
          model.model === "unknown" ? "Unknown model" : model.model,
          model.observedModels.join(", ") || "None",
          formatCompactTokenCount(model.metrics.totalTokens),
          formatUsd(model.metrics.estimatedCostUsd),
        ])}
      />
      <div>
        <CollectionTable
          title="Daily usage (UTC)"
          headers={["Date", "Distinct sessions", "Tokens", "Cost"]}
          rows={daily.map((day) => [
            day.date ?? "Unknown time",
            formatNullableCount(day.metrics.sessionCount),
            formatCompactTokenCount(day.metrics.totalTokens),
            formatUsd(day.metrics.estimatedCostUsd),
          ])}
        />
        <p className="mt-2 text-sm text-slate-600">
          Daily session counts are distinct within each day and are non-additive across days.
        </p>
      </div>
    </section>
  );
}

function CollectionTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-slate-600">No records.</p>
      ) : (
        <div className="table-scroll mt-4">
          <Table>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
