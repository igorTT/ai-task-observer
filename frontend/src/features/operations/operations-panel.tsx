import { useEffect, useRef, useState } from "react";
import { Activity, Calculator, Database, RefreshCw, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { dashboardApi } from "@/api/dashboard-api";
import {
  useCostCalculationStatusQuery,
  useImportStatusQuery,
  useLinearStatusQuery,
  useLinearSyncMutation,
  useRecalculateCostsMutation,
  useRescanMutation,
} from "@/api/dashboard-api";
import type {
  CostCalculationStatusResponse,
  ImportStatusResponse,
  LinearStatusResponse,
} from "@/api/generated/api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api-error";
import { formatCode, formatDateTime } from "@/lib/formatters";

export function OperationsPanel() {
  const [open, setOpen] = useState(false);
  const imports = useImportStatusQuery();
  const linear = useLinearStatusQuery();
  const costs = useCostCalculationStatusQuery();
  useTerminalTimelineRefresh(isActive(imports.data?.currentRun?.state));
  useTerminalTimelineRefresh(Boolean(costs.data?.active || costs.data?.queued));
  const refreshing = imports.isFetching || linear.isFetching || costs.isFetching;
  const attention =
    imports.isError ||
    linear.isError ||
    costs.isError ||
    imports.data?.roots.some((root) => !root.available) ||
    linear.data?.configured === false ||
    costs.data?.coverage !== "current";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls="operations-panel"
        onClick={() => setOpen(!open)}
      >
        <Activity size={16} aria-hidden="true" /> <span className="ml-2">Operations</span>
        <Badge className={attention ? "ml-2 text-amber-800" : "ml-2 text-emerald-700"}>
          {attention ? "Attention" : "Healthy"}
        </Badge>
      </Button>
      {open && (
        <aside id="operations-panel" aria-label="Operational status" className="operations-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Operational status</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Refresh operational status"
                aria-busy={refreshing}
                disabled={refreshing}
                onClick={() => {
                  void Promise.all([imports.refetch(), linear.refetch(), costs.refetch()]);
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span className="ml-2">{refreshing ? "Refreshing…" : "Refresh"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Close operational status"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <ImportStatus data={imports.data} error={imports.error} />
            <LinearStatus data={linear.data} error={linear.error} />
            <CostStatus data={costs.data} error={costs.error} />
          </div>
        </aside>
      )}
    </>
  );
}

function ImportStatus({ data, error }: { data: ImportStatusResponse | undefined; error: unknown }) {
  const [run, action] = useRescanMutation();
  const active = isActive(data?.currentRun?.state);
  const attentionCheckpoints =
    data?.checkpoints.filter(
      (checkpoint) =>
        checkpoint.status !== "ready" ||
        checkpoint.unknownRecords > 0 ||
        checkpoint.malformedRecords > 0 ||
        Boolean(checkpoint.lastError),
    ) ?? [];
  return (
    <StatusCard
      icon={<Database />}
      title="Session import"
      state={
        active
          ? data?.currentRun?.state
          : data?.roots.every((root) => root.available)
            ? "healthy"
            : "attention"
      }
      error={error ?? action.error}
      action="Rescan sessions"
      pending={action.isLoading || active}
      onAction={() => void run()}
    >
      {data && (
        <>
          <p>
            {data.roots.filter((root) => root.available).length}/{data.roots.length} roots available
            · {data.checkpoints.length} checkpoints
          </p>
          {data.roots
            .filter((root) => !root.available)
            .map((root) => (
              <Alert className="mt-2" key={root.root}>
                {root.root}: {root.reason ?? "Unavailable"}
              </Alert>
            ))}
          {data.currentRun && (
            <p className="mt-2">
              Current run {data.currentRun.runId}: {formatCode(data.currentRun.state)} ·{" "}
              {data.currentRun.sessionsImported} sessions imported
            </p>
          )}
          {data.lastCompletedRun && (
            <p className="mt-2">
              Last run {data.lastCompletedRun.runId}: {data.lastCompletedRun.warnings} warnings ·{" "}
              {data.lastCompletedRun.errors} errors
            </p>
          )}
          {attentionCheckpoints.map((checkpoint) => (
            <p className="mt-2" key={checkpoint.source}>
              Checkpoint {checkpoint.source}: {formatCode(checkpoint.status)} at offset{" "}
              {checkpoint.completeOffset} · {checkpoint.unknownRecords} unknown ·{" "}
              {checkpoint.malformedRecords} malformed
              {checkpoint.lastError && ` · ${checkpoint.lastError}`}
            </p>
          ))}
        </>
      )}
    </StatusCard>
  );
}
function LinearStatus({ data, error }: { data: LinearStatusResponse | undefined; error: unknown }) {
  const [run, action] = useLinearSyncMutation();
  const active = isActive(data?.currentRun?.state);
  return (
    <StatusCard
      icon={<RefreshCw />}
      title="Linear sync"
      state={
        !data?.configured
          ? "unconfigured"
          : active
            ? data.currentRun?.state
            : (data?.state ?? "unknown")
      }
      error={error ?? action.error}
      action="Synchronize Linear"
      pending={action.isLoading || active}
      disabled={!data?.configured || !data.acceptingWork}
      onAction={() => void run()}
    >
      {data && (
        <>
          <p>
            {data.configured ? "Configured" : "Unconfigured"} · {data.counts.linked} linked ·{" "}
            {data.counts.not_found} not found · {data.counts.error} errors
          </p>
          {data.currentRun && (
            <p className="mt-2">
              Current run {data.currentRun.runId}: {formatCode(data.currentRun.state)} ·{" "}
              {data.currentRun.candidateCount} candidates
            </p>
          )}
          {data.lastCompletedRun && (
            <p className="mt-2">
              Last run {data.lastCompletedRun.runId}: {data.lastCompletedRun.linkedCount} linked ·{" "}
              {data.lastCompletedRun.errorCount} errors
            </p>
          )}
        </>
      )}
    </StatusCard>
  );
}
function CostStatus({
  data,
  error,
}: {
  data: CostCalculationStatusResponse | undefined;
  error: unknown;
}) {
  const [run, action] = useRecalculateCostsMutation();
  const active = Boolean(data?.active || data?.queued);
  return (
    <StatusCard
      icon={<Calculator />}
      title="Cost calculation"
      state={active ? (data?.active?.state ?? data?.queued?.state) : (data?.coverage ?? "unknown")}
      error={error ?? action.error}
      action="Recalculate costs"
      pending={action.isLoading || active}
      disabled={!data?.acceptingWork}
      onAction={() => void run()}
    >
      {data && (
        <>
          <p>
            Coverage: {data.coverage}.{" "}
            {data.latestCompleted
              ? `Generation ${data.latestCompleted.generationId} completed ${formatDateTime(data.latestCompleted.completedAt)}`
              : "No completed generation."}
          </p>
          <p className="mt-2">
            Catalog {data.config.catalogVersion} · calculator {data.calculatorVersion} · fact
            revision {data.currentFactRevision}
          </p>
          {data.latestFailure && (
            <Alert className="mt-2">
              Generation {data.latestFailure.generationId} failed:{" "}
              {formatCode(data.latestFailure.failureCategory ?? "calculation_failed")}
            </Alert>
          )}
        </>
      )}
    </StatusCard>
  );
}

function StatusCard({
  icon,
  title,
  state,
  error,
  action,
  pending,
  disabled,
  onAction,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  state: string | undefined;
  error?: unknown;
  action: string;
  pending: boolean;
  disabled?: boolean;
  onAction: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h3>
        <Badge>{formatCode(state ?? "unknown")}</Badge>
      </div>
      <div className="mt-3 text-sm text-slate-600">{children}</div>
      {Boolean(error) && <Alert className="mt-3">{normalizeApiError(error).message}</Alert>}
      <Button className="mt-4" size="sm" disabled={pending || disabled} onClick={onAction}>
        {pending ? "Work in progress…" : error ? `Retry ${action.toLowerCase()}` : action}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? `${title} queued or running` : error ? `${title} failed` : `${title} ${state}`}
      </span>
    </Card>
  );
}
function isActive(state?: string) {
  return state === "queued" || state === "running" || state === "active";
}

function useTerminalTimelineRefresh(active: boolean) {
  const dispatch = useDispatch();
  const wasActive = useRef(false);
  useEffect(() => {
    if (active) {
      wasActive.current = true;
      return;
    }
    if (!wasActive.current) return;
    wasActive.current = false;
    dispatch(dashboardApi.util.invalidateTags(["UsageTimeline"]));
  }, [active, dispatch]);
}
