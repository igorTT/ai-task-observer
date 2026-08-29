## Context

See `proposal.md` for motivation. DuckDB's Node API returns `TIMESTAMP` as a timezone-less value.
Passing that object to `new Date(...)` first renders a timezone-less string, which JavaScript then
interprets in the process timezone. In Europe/Bratislava, an observation stored as
`2026-08-22 18:05:00` is therefore exposed as `2026-08-22T16:05:00.000Z`.

Development databases may contain two historical `TIMESTAMP` conventions. Source and application
dates were bound as ISO UTC strings and stored as UTC wall times, while defaults such as
`current_timestamp` could be cast to the database session's local wall time. There are no deployed
consumers, so these local files can be discarded rather than repaired in place.

## Goals / Non-Goals

**Goals:**

- Give every persisted instant an unambiguous timezone-aware representation.
- Make newly persisted source, application, and database-generated values unambiguous.
- Centralize DuckDB-to-JavaScript instant conversion and eliminate locale-dependent parsing.
- Keep calendar-only `DATE` values distinct from instants.

**Non-Goals:**

- Changing source record parsing or client-local presentation.
- Reinterpreting UTC daily aggregation keys as instants.
- Increasing timestamp precision beyond JavaScript `Date` milliseconds.

## Decisions

### Define the current schema with `TIMESTAMPTZ`

The project has no deployed consumers yet, so discard the local development database and define
the current schema directly with `TIMESTAMPTZ` columns in one baseline SQL file. Future ISO bindings
and database functions such as `current_timestamp` then carry an absolute instant regardless of the
process or database display timezone. Keep genuine calendar values such as issue activity dates as
`DATE`. No forward-compatible upgrade migration is maintained at this stage.

Alternative considered: retain `TIMESTAMP` and append `Z` while reading. Rejected because it would
still leave database-generated local wall times ambiguous and would rely on every call site knowing
the historical origin of its column.

Alternative considered: set the DuckDB session timezone to UTC without changing column types.
Rejected because `TIMESTAMP` remains timezone-less at the JavaScript boundary and existing mixed
semantics would remain unresolved.

### Reset development data instead of migrating historical values

There are no consumers or durable databases that need preservation during this active-development
phase. Delete the local DuckDB file and recreate it from the baseline. This avoids encoding
historical wall-time provenance into an upgrade path while ensuring every newly written instant is
unambiguous.

Alternative considered: discard and re-import source-derived data. Rejected because not every
deployment can assume all historical source files remain available, and it would not repair
non-source operational records.

### Convert timestamp values from numeric epoch data

Add a shared database-model helper that accepts the DuckDB timestamp-with-timezone runtime value
and creates a JavaScript `Date` from its microsecond epoch field. It will handle nullable columns
explicitly, validate the resulting range, and never rely on `String(value)` or the host timezone.
All instant row models and direct repository projections will use this helper. Calendar `DATE`
mapping will use a separate UTC-date conversion path.

Alternative considered: continue calling `new Date` directly after the schema migration. Although
the timezone-aware object's string currently includes an offset, this still couples correctness to
implicit string coercion and makes future driver changes harder to audit.

### Verify in non-UTC and daylight-saving contexts

Tests will exercise the mapper, a baseline database fixture, API serialization, and timeline
assignment under `Europe/Bratislava`. Include winter and summer instants to cover both one- and
two-hour offsets, plus a UTC bucket boundary. Assertions compare epoch milliseconds and ISO output,
not locale-formatted strings.

## Risks / Trade-offs

- [Historical database files contain ambiguous wall times] → Delete local development databases
  while there are no deployed consumers and recreate them from the baseline.
- [Changing timestamp types touches many tables] → Use one explicit baseline schema with column
  inventory, constraint/index verification, and repository regression tests.
- [DuckDB returns microseconds while JavaScript retains milliseconds] → Truncate only sub-millisecond
  precision and test exact millisecond preservation used by current sources.
- [A missed unsafe conversion leaves inconsistent APIs] → Add a static repository-wide check or
  focused test that rejects direct `new Date(row timestamp)` patterns in database mapping code.

## Development Reset Plan

1. Delete the local DuckDB file because no deployed consumer depends on its contents.
2. Create all tables and indexes from the current baseline with instant columns typed as
   `TIMESTAMPTZ`.
3. Deploy the shared mapper and converted model call sites together with the baseline.
4. Verify representative session, observation, cost, and synchronization timestamps plus timeline
   buckets under a non-UTC timezone.

Rollback during this phase is another local database reset; there is no historical upgrade path to
reverse.
