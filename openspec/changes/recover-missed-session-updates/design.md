## Context

See `proposal.md` for motivation. The coordinator currently starts native Chokidar watchers before
startup backfill and has a periodic timer that revisits only unavailable roots. A missed native
event for an available root therefore has no automatic recovery path. Incremental checkpoints and
the serialized pending-work map already make repeated source inspection safe.

The observed workspace has roughly two hundred rollout files. Any fallback must avoid Chokidar's
100 ms polling mode, which would continuously stat every watched file, while bounding how long
recent usage can remain stale.

## Goals / Non-Goals

**Goals:**

- Recover missed append and creation events within a configurable, minute-scale interval.
- Retain native watcher events for low-latency ingestion when the platform delivers them.
- Reuse existing discovery, incremental import, checkpoint, and single-writer coordination.
- Keep recovery work bounded, non-overlapping, observable, and safe during shutdown.

**Non-Goals:**

- Detecting changes faster than the configured sweep interval when native events fail.
- Introducing a second database writer or a second source-import implementation.
- Adding API controls, database state, or frontend status specific to recovery sweeps.

## Decisions

### Use periodic reconciliation instead of Chokidar polling

Keep Chokidar in native-event mode. On the existing root-rediscovery interval, rediscover every
configured root and enqueue each supported file from available roots through the coordinator's
existing pending-work map. The importer will compare source identity and size with its checkpoint,
return cheaply for unchanged files, and process only appended complete records for changed files.

The default interval remains 60 seconds through the existing
`CODEX_ROOT_REDISCOVERY_MS` setting. This gives a bounded one-minute stale window without a new
configuration surface. The setting continues to control recovery of unavailable roots and now
also controls reconciliation of available roots.

Alternative considered: enable Chokidar `usePolling` in production. Rejected because the current
100 ms polling interval performs continuous checks across every rollout file and is disproportionate
for a dashboard where minute-scale recovery is acceptable.

Alternative considered: watch only the newest file with polling. Rejected because multiple Codex
tasks can be active concurrently and newly created files would still depend on unreliable native
creation events.

### Route recovery through existing serialized work

Recovery does not import directly. It enqueues discovered paths through the same map and drain used
by watcher, startup, and rescan work. Map replacement coalesces duplicate pending paths; the single
drain preserves DuckDB writer ownership. If a sweep is requested while another sweep is running,
coalesce it rather than overlap directory walks.

Alternative considered: create a separate recovery queue. Rejected because it would duplicate
coordination and make overlapping imports easier to introduce.

### Keep recovery operational evidence out of the API contract

Emit sanitized summary logs for a recovery failure and, at debug level, sweep completion counts.
Per-source importer failures continue through existing sanitized diagnostics. Do not add a new run
trigger or response fields because recovery is background maintenance, not a user-requested
operation.

Alternative considered: persist every sweep as an import run. Rejected because a run every minute
would add noisy operational state and change the public status semantics for mostly unchanged data.

### Test the fallback independently of native event delivery

Coordinator tests will suppress watcher-driven enqueueing, append or create a source, and advance a
short injected recovery interval. Assertions will cover eventual incremental import, unchanged
idempotence, overlap coalescing, failure isolation, and shutdown timer cleanup. Production keeps the
minute default; tests use short explicit intervals only.

## Risks / Trade-offs

- [Each sweep walks all available roots and inspects every supported file] → Use the minute-scale
  interval, sequential/coalesced scheduling, and existing 256-byte source identity check; record
  timing in debug logs so the interval can be tuned if the source population grows materially.
- [A sweep enqueues many unchanged files] → The importer exits after checkpoint comparison without
  parsing or writing, and the pending map deduplicates paths.
- [A sweep duration exceeds its interval] → Permit only one reconciliation operation at a time and
  coalesce a subsequent tick.
- [Reusing the root-rediscovery setting broadens its meaning] → Update configuration documentation
  and tests to describe it as both availability rediscovery and missed-event recovery.
- [Recovery remains eventually consistent] → Preserve explicit rescan for immediate operator
  recovery and native events for the normal fast path.

## Migration Plan

Deploy as a backend-only behavior change with the existing 60-second configuration default. No
schema or data migration is required. On startup, existing checkpoints remain authoritative and the
first scheduled sweep catches any later missed updates. Rollback restores the old scheduling
behavior without changing persisted data; an explicit rescan can catch up stale checkpoints.
