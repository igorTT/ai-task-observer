## Context

See `proposal.md` for motivation and `specs/usage-dashboard/spec.md` for observable behavior. The
operations panel currently mounts three status queries with the application shell and installs a
separate interval for each query when its response reports active work. RTK Query already retains
cached data during refetches and invalidates the relevant status tags after operational mutations.
The import response contains one checkpoint per discovered session file, so rendering every healthy
checkpoint makes the panel grow with the size of the local archive.

## Goals / Non-Goals

**Goals:**

- Make all user-initiated status refreshes explicit and predictable.
- Refresh the three subsystem statuses as one user action while preserving subsystem-specific error
  reporting.
- Keep the import overview bounded in the common healthy case and retain actionable diagnostics.
- Preserve existing generated API contracts and mutation cache invalidation.

**Non-Goals:**

- Changing backend status payloads, ingestion checkpoints, or DuckDB persistence.
- Providing real-time completion notifications or cross-tab synchronization.
- Building a full checkpoint diagnostics browser or changing the meaning of subsystem health.

## Decisions

### Use one panel-level refresh control

The panel will invoke the existing `refetch` function from each of the import, Linear, and cost
queries. The control will be disabled and labelled as refreshing while any of those queries is
fetching. Each status card will continue to own its error display, allowing a partial refresh failure
to leave successful and previously cached results visible.

Alternatives considered:

- Three refresh controls were rejected because status is presented as one operational summary and
  users should not need to understand which endpoint has stale data.
- Cache-tag invalidation from a synthetic action was rejected because direct refetches clearly map to
  the explicit user action and require no new API-layer abstraction.

### Remove interval-based status refetching

The polling constant, interval hook, and calls that install polling will be removed. Existing
active-state classification will remain for badges and duplicate-action prevention. Queued or active
states returned by an initial request, an explicit refresh, or mutation-triggered cache invalidation
remain visible, but the client will not repeatedly query for their completion. The user can refresh
when the completion state matters.

Server-sent events and a slower universal interval were rejected because the local operational view
does not require real-time updates, and either approach adds background work solely for freshness.

### Filter checkpoint details in the presentation layer

The client will derive attention checkpoints from the existing response. A checkpoint is actionable
when its state is not `ready`, either diagnostic count is nonzero, or `lastError` is present. The
panel will always show the total checkpoint count and will render the existing per-checkpoint detail
only for that derived subset. No checkpoint data is altered or discarded by the backend.

Backend filtering or a new summary endpoint was rejected because the existing payload is already
required for status, the behavior is presentation-specific, and changing the OpenAPI contract would
expand an otherwise contained UI change.

## Risks / Trade-offs

- [A completed operation remains displayed as active until refresh] → Make the shared refresh action
  prominent and keep mutation-triggered invalidation so the first accepted state appears promptly.
- [Large checkpoint payloads are still transferred once] → This change targets recurring requests
  and visual overload; backend aggregation can be proposed separately if payload size becomes a
  measured problem.
- [One slow status endpoint keeps the shared control pending] → Retain independent card content and
  errors so the panel remains useful while the aggregate refresh is in progress.
- [A new checkpoint status spelling could be treated as actionable] → Treat every state other than
  the known `ready` state conservatively and show it for diagnosis.

## Migration Plan

Deploy the frontend-only change without data or API migration. Rollback consists of restoring the
previous operations-panel presentation and polling hook; backend state remains compatible in either
direction.
