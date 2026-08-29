## Why

DuckDB `TIMESTAMP` values currently lose their represented UTC instant when converted to
JavaScript dates in a non-UTC process timezone, shifting session and usage timestamps by the local
offset. This places valid token usage in the wrong overview bucket and exposes incorrect lifecycle
times through APIs.

## What Changes

- Store represented instants as DuckDB `TIMESTAMPTZ` values and introduce one UTC-safe conversion
  boundary for values read by backend models and repositories.
- Replace unsafe `new Date(databaseTimestamp)` conversions across session ingestion, usage,
  pricing, Linear synchronization, and query results.
- Preserve nullability and reject or surface invalid timestamp shapes without synthesizing a time.
- Add regression coverage that runs with a non-UTC timezone and proves source, stored, queried, and
  serialized instants remain identical.
- Define all current instant columns as `TIMESTAMPTZ` in one fresh schema baseline. Because there
  are no deployed consumers, discard the local database instead of maintaining a historical
  timestamp upgrade migration.
- Non-goals: changing frontend client-zone formatting, changing hourly or daily bucket definitions,
  changing source timestamp parsing, or changing calendar-only `DATE` values.
- Dependencies: this correction implements existing UTC and instant-preservation requirements and
  is independent of `recover-missed-session-updates`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Existing `session-usage-events`, `usage-timeline-aggregation`, `issue-usage-aggregation`,
`session-cost-estimation`, and `usage-dashboard` requirements already require UTC event times,
UTC bucketing, and preservation of represented instants. This change corrects implementation that
does not currently conform to those requirements, so no specification delta is needed.

## Impact

- Shared DuckDB timestamp mapping plus database models and repositories that expose JavaScript
  `Date` values.
- Backend model, repository, API, pricing, and timeline regression tests.
- One current DuckDB schema baseline is expected; no upgrade migration, source re-import, generated
  API change, frontend change, or new dependency is expected.
