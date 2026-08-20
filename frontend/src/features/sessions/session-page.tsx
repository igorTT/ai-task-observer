import { useState } from "react";
import { useLinearStatusQuery, useRelinkMutation, useSessionsQuery } from "@/api/dashboard-api";
import type { SessionResponse } from "@/api/generated/api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { MetricState } from "@/features/issues/metrics";
import { PageHeading, PageLoading, RequestError } from "@/features/issues/issue-list-page";
import { normalizeApiError } from "@/lib/api-error";
import { formatCode, formatNullableCount, formatUtcDate } from "@/lib/formatters";
import { PAGE_SIZE, pageOffset, totalPages, useUrlPage } from "@/lib/pagination";

export function SessionPage() {
  const [page, setPage] = useUrlPage();
  const query = useSessionsQuery({ limit: PAGE_SIZE, offset: pageOffset(page) });
  const linear = useLinearStatusQuery();
  if (query.isLoading) return <PageLoading title="Sessions" />;
  if (query.isError) return <RequestError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  return (
    <section className="space-y-6">
      <PageHeading title="Sessions" refreshing={query.isFetching} />
      <p className="text-slate-600">
        Review imported usage and explicitly apply valid title candidates. A candidate never
        replaces a committed issue until you confirm it.
      </p>
      {query.data.items.length === 0 ? (
        <Card>No imported sessions on this page.</Card>
      ) : (
        <div className="space-y-4">
          {query.data.items.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              linearReady={Boolean(linear.data?.configured && linear.data.acceptingWork)}
            />
          ))}
        </div>
      )}
      <Pagination page={page} pages={totalPages(query.data.total)} onPage={setPage} />
    </section>
  );
}

function SessionCard({ session, linearReady }: { session: SessionResponse; linearReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [relink, mutation] = useRelinkMutation();
  const attribution = session.attribution;
  const canRelink = Boolean(
    attribution.candidateIdentifier && linearReady && attribution.status !== "pending",
  );
  const commit = async () => {
    try {
      await relink({ sessionId: session.sessionId }).unwrap();
      setOpen(false);
    } catch {
      /* rendered below */
    }
  };
  const reason = !attribution.candidateIdentifier
    ? "No valid issue candidate in the current title."
    : !linearReady
      ? "Linear is unconfigured or not accepting work."
      : attribution.status === "pending"
        ? "Attribution is already pending."
        : undefined;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{session.currentTitle ?? "Untitled session"}</h2>
          <p className="mono">{session.sessionId}</p>
        </div>
        <Badge>{formatCode(attribution.status)}</Badge>
      </div>
      <dl className="record-grid mt-4">
        <div>
          <dt>Candidate</dt>
          <dd>{attribution.candidateIdentifier ?? "None"}</dd>
        </div>
        <div>
          <dt>Committed issue</dt>
          <dd>
            {attribution.issue
              ? `${attribution.issue.identifier} — ${attribution.issue.title}`
              : "Unlinked"}
          </dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{attribution.phase ?? "No phase"}</dd>
        </div>
        <div>
          <dt>Synchronization</dt>
          <dd>{formatCode(attribution.synchronizationState)}</dd>
        </div>
        <div>
          <dt>Import state</dt>
          <dd>{formatCode(session.importState)}</dd>
        </div>
        <div>
          <dt>Usage</dt>
          <dd>
            {session.usageObserved
              ? `${formatNullableCount(session.totalTokens)} tokens`
              : "No usage observed"}
          </dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatUtcDate(session.startedAt)}</dd>
        </div>
        <div>
          <dt>Developer turns</dt>
          <dd>{formatNullableCount(session.developerTurns)}</dd>
        </div>
      </dl>
      {attribution.relinkRequired && (
        <Alert className="mt-4">
          The current title points to {attribution.candidateIdentifier}, but usage remains committed
          to {attribution.issue?.identifier}. Confirm replacement to move it.
        </Alert>
      )}
      {attribution.failureCategory && (
        <Alert className="mt-4">
          {formatCode(attribution.failureCategory)}. Refresh the session and retry when the service
          is available.
        </Alert>
      )}
      <div className="mt-4">
        <MetricState
          metrics={{
            sessionCount: "1",
            developerTurns: session.developerTurns,
            inputTokens: session.inputTokens,
            cachedInputTokens: session.cachedInputTokens,
            outputTokens: session.outputTokens,
            totalTokens: session.totalTokens,
            estimatedCostUsd: null,
            tokenComplete: Object.values(session.tokenCompleteness).every(Boolean),
            costComplete: false,
            anomalyCodes: session.usageAnomalies,
            pricingGapCodes: [],
          }}
        />
      </div>
      <div className="mt-4">
        <Button disabled={!canRelink || mutation.isLoading} onClick={() => setOpen(true)}>
          {attribution.relinkRequired ? "Review replacement" : "Link candidate"}
        </Button>
        {reason && <p className="mt-2 text-sm text-slate-600">{reason}</p>}
      </div>
      {mutation.isError && (
        <Alert className="mt-4">
          {normalizeApiError(mutation.error).message} The committed issue has not changed.
        </Alert>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={attribution.relinkRequired ? "Replace committed issue?" : "Link this session?"}
        description={
          attribution.relinkRequired ? (
            <>
              Replace <strong>{attribution.issue?.identifier}</strong> with candidate{" "}
              <strong>{attribution.candidateIdentifier}</strong>. Usage moves only after the server
              confirms success.
            </>
          ) : (
            <>
              Link this session to candidate <strong>{attribution.candidateIdentifier}</strong>?
            </>
          )
        }
        confirmLabel={attribution.relinkRequired ? "Confirm replacement" : "Confirm link"}
        pending={mutation.isLoading}
        onConfirm={() => void commit()}
      />
    </Card>
  );
}
