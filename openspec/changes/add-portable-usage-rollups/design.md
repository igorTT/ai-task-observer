## Context

The current timeline repository reads raw usage observations, joins current phase assignments, and
performs bucket and metric aggregation in application code. Cost values come from the latest
completed cost generation, and session phase assignments are mutable independently of usage facts.
The proposal and delta specifications define the motivation and externally visible behavior.

The design must preserve exact half-open range boundaries, partial completeness, unknown-time
counts, current phase filtering, and cost-generation provenance. It must also preserve the existing
single-writer DuckDB boundary while keeping the derived-data model portable to PostgreSQL.

## Goals / Non-Goals

**Goals:**

- Reduce long-range timeline work from raw observations to a bounded derived fact population.
- Keep raw observations and completed cost generations as the audit source of truth.
- Make phase changes visible immediately without rebuilding historical usage summaries.
- Make rollups rebuildable, incrementally maintainable, and safe during asynchronous lag.
- Keep the persistence boundary suitable for a later PostgreSQL adapter.
- Support exact hourly short ranges and a daily 90-day response, including partial edge intervals.

**Non-Goals:**

- A PostgreSQL migration, connection pool, hosted database, or multi-instance deployment.
- Database-native materialized views, triggers, or engine-specific refresh mechanisms.
- Replacing the existing cost-calculation generation model.
- General analytics, arbitrary date ranges, or user-defined grouping dimensions.

## Decisions

### Use application-managed session-hour rollups

Add a derived table with one row per active session and UTC hour. Each row stores the normalized
token metrics, known cost, token and cost completeness, sanitized warning state, unknown-time count
where applicable, source fact revision, and cost-generation identity needed to establish freshness.
The repository owns the SQL and maps rows into domain-level rollup records.

Session-level rather than phase-level rows are intentional: phase is mutable metadata, while the
usage contribution of a session is stable. The timeline query joins the current assignment and
groups the session-hour rows into the requested phase and time buckets.

Alternatives considered:

- **Phase-specific rollups:** rejected because assigning, replacing, or clearing a phase would
  require rewriting historical aggregates and would make phase changes expensive.
- **Global hourly rollups only:** rejected because current phase filtering would still require
  scanning raw observations or a large ungrouped population.
- **Database-native materialized views:** rejected because refresh behavior and syntax would tie the
  reporting path to DuckDB and complicate the PostgreSQL migration.

### Use rollups for full hours and source facts for partial boundary hours

Short ranges already have partial first and last UTC hours. A 90-day request will have daily output,
but its exact start and end instants may still cut through an hour or day. The query will use
session-hour rollups for complete hours and read source facts only for partial edge hours, then
combine them into hourly or daily response buckets.

This avoids inventing a rounded cutoff and avoids maintaining a second daily rollup solely to handle
an exact partial-day boundary. If a future workload demonstrates that the session-hour population
is still too large, daily rollups can be added as an additive optimization without changing the
contract.

### Track derived-data freshness explicitly

Rollup rows will record the source fact revision and cost-generation identity used to produce them.
An application-owned rollup state/reconciliation path will identify missing or stale rows after
startup, ingestion, and cost-generation completion.

The timeline query will use rollups only when the selected population is current. During catch-up,
it will fall back to the existing source-fact aggregation path for affected data rather than
silently returning incomplete totals. The fallback is also the recovery path after a failed or
interrupted rollup rebuild.

### Refresh derived data asynchronously from existing lifecycle events

Committed ingestion will continue to notify the existing background coordination path, and a
completed cost generation will schedule rollup refresh for the affected source revision and
generation. Refresh work will be serialized through the existing single-writer database boundary.

A startup reconciliation will backfill the additive table from existing facts. It will be safe to
run repeatedly: rows are rebuilt from the source population for their session-hour key, and a
failed refresh leaves the source facts and prior completed rollups intact.

Phase assignment mutations will not refresh rollup rows. They only affect the assignment join used
by the timeline query, so the current phase filter remains authoritative without changing usage
facts or rollup contents.

### Keep the derived schema portable

The rollup schema will use common relational types and plain scalar or text fields for metrics and
sanitized warning data. Bucket boundaries will be calculated by shared application code and stored
as UTC timestamps; queries will not depend on database-specific date bucketing, arrays, JSONB,
triggers, or materialized-view syntax.

DuckDB-specific connection and row-value conversion will remain inside the existing database
adapter/repository boundary. A later PostgreSQL implementation can provide the same repository
operations and rebuild rollups from raw facts rather than importing DuckDB files.

### Represent the 90-day range as a contract extension

Add `90d` to the backend range domain and generated contract. Keep the existing `12h` and `24h`
ranges hourly; return daily buckets for `90d`. Frontend URL parsing, selector state, charts, and
the exact bucket table will consume the backend `bucketUnit` rather than assuming every bucket is
an hour.

The range remains half-open and uses one captured `endAt`. Daily grouping uses UTC calendar
boundaries, with partial edge buckets assembled from the exact source/rollup combination described
above.

## Risks / Trade-offs

- **[Rollup lag could hide new usage]** → Keep the source-fact fallback and only use rollups after
  freshness checks; add differential tests comparing both paths.
- **[A cost generation can invalidate many rows]** → Run refresh in the background, retain the
  prior completed generation, and report existing stale/partial cost coverage until the new
  generation is fully represented.
- **[Session-hour storage grows with active sessions]** → Store rows only for buckets with committed
  activity, add indexes for session and bucket lookups, and defer daily compaction until measurement
  shows it is needed.
- **[Phase assignment changes race with timeline reads]** → Apply the assignment join and rollup
  aggregation in one repository query/snapshot so a response observes one consistent assignment
  state.
- **[Portable SQL may limit engine-specific tuning]** → Keep SQL simple and isolate any future
  engine-specific optimization behind the repository without changing the domain contract.
- **[Backfill competes with ingestion]** → Schedule it through the single-writer coordinator and
  process bounded batches; source reads remain available during the backfill.

## Migration Plan

1. Add the rollup schema and repository without changing the existing timeline read path.
2. Add asynchronous refresh and startup reconciliation; keep raw aggregation as the correctness
   fallback while existing data is backfilled.
3. Verify rollup results against source-fact results for short ranges, phase filters, incomplete
   costs, unknown timestamps, and empty ranges.
4. Enable rollup reads after reconciliation reports current coverage, retaining the fallback for
   any stale or missing keys.
5. Add the `90d` API contract and frontend range only after rollup reads and daily presentation are
   verified.

Rollback disables rollup reads and leaves raw observations, cost generations, and the additive
rollup table intact. The database can then be rebuilt or the rollup table can be removed in a later
cleanup migration; no source data migration is required.
