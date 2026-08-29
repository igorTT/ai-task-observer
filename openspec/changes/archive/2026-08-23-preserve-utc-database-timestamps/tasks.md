## 1. Current Timestamp Schema

- [x] 1.1 Inventory every DuckDB `TIMESTAMP` column, classify it as a represented instant or a
  calendar-only value, and classify historical instant values by UTC-origin versus
  database-local-origin semantics.
- [x] 1.2 Replace the historical migration chain with one current schema baseline that defines
  instant columns as `TIMESTAMPTZ` while preserving nullability, defaults, constraints, keys, and
  indexes. No deployed consumer requires an in-place upgrade path.
- [x] 1.3 Add baseline schema tests covering timezone-aware columns, constraints, indexes, and
  winter and summer values under `Europe/Bratislava`.

## 2. UTC-Safe Database Mapping

- [x] 2.1 Add shared database-model helpers that convert DuckDB timestamp-with-timezone epoch
  microseconds to validated JavaScript `Date` instances and map calendar `DATE` values separately.
- [x] 2.2 Update database row interfaces to use the actual DuckDB runtime timestamp types instead
  of declaring timestamp fields as JavaScript `Date` values.
- [x] 2.3 Replace unsafe timestamp conversions across session, event, usage, import, Linear,
  pricing, cost-generation, issue-usage, migration, and timeline mappings while preserving optional
  and nullable response behavior.
- [x] 2.4 Add a repository-wide guard that detects direct string-coercing `new Date(row timestamp)`
  patterns in database mapping code.

## 3. Behavioral Regression Coverage

- [x] 3.1 Add non-UTC session API tests proving source lifecycle and event instants serialize to the
  same ISO instants that were ingested.
- [x] 3.2 Add timeline tests proving summer and winter observations remain in their correct UTC
  hourly buckets, including an observation exactly on a boundary.
- [x] 3.3 Add pricing, cost-generation, Linear synchronization, and issue daily-aggregation tests
  proving timestamp conversion does not change period selection or UTC calendar assignment.
- [x] 3.4 Verify a fresh database uses the baseline directly and does not require source re-import
  or a legacy migration path.

## 4. Verification

- [x] 4.1 Run focused migration, database-model, session API, usage timeline, issue usage, Linear,
  and pricing tests under a non-UTC timezone.
- [x] 4.2 Run formatting, linting, type-checking, the full backend test suite, backend build, and
  smoke verification.
