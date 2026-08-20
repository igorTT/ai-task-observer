import { ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useListIssueUsageQuery } from "@/api/dashboard-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricGrid, MetricState } from "@/features/issues/metrics";
import { normalizeApiError } from "@/lib/api-error";
import { PAGE_SIZE, pageOffset, totalPages, useUrlPage } from "@/lib/pagination";

export function IssueListPage() {
  const [page, changePage] = useUrlPage();
  const query = useListIssueUsageQuery({ limit: PAGE_SIZE, offset: pageOffset(page) });
  if (query.isLoading) return <PageLoading title="Issue usage" />;
  if (query.isError) return <RequestError error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  if (!data) return null;
  const pages = totalPages(data.total);
  return (
    <section className="space-y-6">
      <PageHeading title="Issue usage" refreshing={query.isFetching} />
      {data.items.length === 0 ? (
        page > 1 ? (
          <Card>
            <h2 className="text-lg font-semibold">No issues on this page</h2>
            <p className="mt-2 text-slate-600">This page may be stale after attribution changed.</p>
            <Button className="mt-4" onClick={() => changePage(page - 1)}>
              Previous page
            </Button>
          </Card>
        ) : (
          <Card>
            <h2 className="text-lg font-semibold">No linked usage yet</h2>
            <p className="mt-2 text-slate-600">
              Imported sessions need valid Linear attribution before issue totals appear.
            </p>
            <Link className="button-link mt-4" to="/sessions">
              Review sessions
            </Link>
          </Card>
        )
      ) : (
        <div className="space-y-4">
          {data.items.map(({ issue, metrics }) => (
            <Card key={issue.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    className="text-lg font-semibold text-primary hover:underline"
                    to={`/issues/${encodeURIComponent(issue.id)}`}
                  >
                    {issue.identifier}
                  </Link>
                  <h2 className="text-slate-700">{issue.title}</h2>
                </div>
                <a className="safe-link" href={issue.url} target="_blank" rel="noreferrer">
                  Open in Linear <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
              <div className="mt-4">
                <MetricGrid metrics={metrics} />
              </div>
              <div className="mt-4">
                <MetricState metrics={metrics} />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={changePage} />
    </section>
  );
}

export function PageHeading({ title, refreshing }: { title: string; refreshing?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="eyebrow">Usage dashboard</p>
        <h1>{title}</h1>
      </div>
      {refreshing && (
        <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-600">
          <RefreshCw className="animate-spin" size={16} /> Refreshing
        </span>
      )}
    </div>
  );
}
export function PageLoading({ title }: { title: string }) {
  return (
    <section aria-label={`Loading ${title}`} className="space-y-4">
      <h1>{title}</h1>
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </section>
  );
}
export function RequestError({ error, retry }: { error: unknown; retry: () => void }) {
  const normalized = normalizeApiError(error);
  return (
    <Alert>
      <h1 className="font-semibold">Unable to load this view</h1>
      <p className="mt-1">{normalized.message}</p>
      <Button className="mt-3" variant="outline" onClick={retry}>
        Try again
      </Button>
    </Alert>
  );
}
