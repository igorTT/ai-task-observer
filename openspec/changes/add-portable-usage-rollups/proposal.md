## Why

The usage timeline currently reads and aggregates raw observations for every request. This is
acceptable for short windows, but the work grows with the number of observations and could make a
90-day overview slow or memory-intensive. We need prepared values without coupling the reporting
path to DuckDB-specific materialized views or phase-specific aggregates before a future PostgreSQL
deployment.

## What Changes

- Add durable, application-managed usage rollups at the session and time-bucket level.
- Maintain rollups asynchronously after ingestion and completed cost generations, with explicit
  handling for stale or incomplete rollups.
- Keep phase assignment out of the rollup key; apply the current phase when querying so assigning,
  replacing, or clearing a phase does not require rewriting historical usage.
- Extend usage timeline ranges to support a 90-day view with daily buckets while preserving the
  existing short-range hourly behavior.
- Preserve existing token, cost, completeness, warning, unknown-time, and cost-generation
  provenance semantics when results come from rollups.
- Add the corresponding dashboard range selection and daily-bucket presentation.

### Non-goals

- Do not migrate the application database from DuckDB to PostgreSQL in this change.
- Do not remove or rewrite raw usage observations, cost generations, or existing short-range APIs.
- Do not create database-native materialized views, triggers, or a second writable database process.
- Do not add arbitrary date ranges or a general-purpose analytics query language.

### Dependencies

- The completed `filter-usage-overview-by-session-phase` change remains the source of current phase
  filtering semantics.
- Existing session phase management and cost-generation workflows remain authoritative; rollups are
  derived data and must not change their behavior.
- A future PostgreSQL migration can replace the persistence adapter and migrations independently.

## Capabilities

### New Capabilities

- `usage-rollup-maintenance`: Maintains portable, session-level time-bucket rollups and rebuilds or
  invalidates them when source usage or cost-generation inputs change.

### Modified Capabilities

- `usage-timeline-aggregation`: Adds the 90-day daily range and requires equivalent results when
  timelines are served from prepared rollups, including current session-phase filtering.
- `usage-dashboard`: Adds 90-day range selection and renders daily timeline buckets without
  weakening existing loading, completeness, warning, or zero-usage behavior.

## Impact

- Backend migrations, rollup repositories, background coordination, and usage-timeline query
  services will be affected.
- The generated API contract will gain the 90-day range and daily bucket-unit values.
- The frontend overview range state, selector, chart, and exact-bucket table will be affected.
- Storage usage will increase for derived rollup rows, while raw observations and completed cost
  generations remain the audit source of truth.
- No new runtime database dependency is introduced; the design must remain usable with DuckDB and
  portable to PostgreSQL.
