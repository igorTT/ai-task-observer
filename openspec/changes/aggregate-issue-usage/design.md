## Context

This change reads committed current attribution, selected event/usage facts, and the latest
completed cost generation. Linear attribution already guarantees one sticky current link per
session and explicit relinking. The frontend consumes only generated OpenAPI/RTK Query code, but
dashboard screens are deliberately outside this change.

## Goals / Non-Goals

**Goals:**

- Provide deterministic, auditable issue list/detail queries with shared accounting semantics.
- Make current-link and UTC bucket behavior obvious in both SQL and API contracts.
- Propagate unknown and partial data without preventing useful known aggregates.
- Avoid stored issue totals that can become stale after relinking or recalculation.

**Non-Goals:**

- Historical attribution reporting or phase grouping.
- Mirroring the entire Linear workspace.
- Date filtering, ranking analytics, dashboards, or client-side aggregation.

## Decisions

### 1. Aggregate from facts at query time

Parameterized repository queries join current session attribution to selected user-message events,
normalized usage observations, and items from the latest completed cost generation. Issue and day
totals are not persisted. This makes an atomic relink or completed cost generation visible without
an additional aggregate refresh and keeps DuckDB as the only data engine.

Views or shared SQL fragments define the common metric projection so list, detail, day, session,
and model queries cannot diverge. Repositories own SQL and return passive rows; a query service
assembles the contract and controllers remain thin.

Alternative: materialize issue/day summary tables. Rejected for the initial scale because relinks,
new events, and recalculation would require multi-table invalidation and could expose stale totals.

Alternative: load sessions into TypeScript and aggregate in memory. Rejected because it bypasses
DuckDB's grouping strengths and increases memory use with history size.

### 2. Join only through the current committed link

The issue population begins with sessions having a current attribution row joined to their cached
Linear issue. Candidate identifiers and title history are never aggregation keys. Because the join
is evaluated at query time, successful relink moves every fact for the session; failed relink makes
no change. Issues with no remaining current session are absent.

Aggregation does not call Linear. Cached issue metadata is display data, while stable Linear issue
ID is the resource identity.

Alternative: stamp the issue ID onto each usage event. Rejected because it would create hidden
attribution history and require rewriting events on relink.

### 3. Use one shared nullable metric shape

Conceptually, every aggregate embeds:

```ts
interface UsageMetricsResponse {
  sessionCount: string;
  developerTurns: string;
  inputTokens: string | null;
  cachedInputTokens: string | null;
  outputTokens: string | null;
  totalTokens: string | null;
  estimatedCostUsd: string | null;
  tokenComplete: boolean;
  costComplete: boolean;
  anomalyCodes: string[];
}
```

Strings preserve integer/decimal precision across JSON. A category is null if any required
contribution for that category is unknown; independently valid categories remain populated. Cost
is the sum of known components from the latest completed generation and is null only when none are
known. Completeness is never inferred merely from a non-null partial value.

Alternative: return zero for unknown. Rejected because zero is a real measurement and would
understate work.

Alternative: omit incomplete sessions entirely. Rejected because it would make issue totals look
complete while hiding known usage.

### 4. Assign daily metrics by the fact that owns the time

Canonical user-message timestamps own developer turns. Usage-observation timestamps own tokens and
their cost items. UTC date is derived in DuckDB; null times group under an explicit unknown bucket
represented as `date: null` in the API. Session count per bucket is `COUNT(DISTINCT session_id)` over
sessions with any assigned activity in that bucket. Consequently daily session counts are
non-additive, while additive metrics reconcile to their all-time totals including the unknown
bucket.

No session start/end/import timestamp fallback is allowed.

### 5. Expose bounded list and detailed resources

Authored tsoa controllers expose conceptual resources:

- `GET /api/issues/usage?limit=&offset=` returns `IssueUsageListResponse` with deterministic
  identifier-then-ID ordering, total count, and issue display metadata plus `UsageMetricsResponse`.
- `GET /api/issues/{issueId}/usage` returns `IssueUsageDetailResponse` with the same issue summary,
  session rows, per-model rows, UTC/null daily rows, and the latest completed cost-generation
  identity when present.

Session rows include stable session ID, title, optional free-form phase, lifecycle/import state,
metrics, and model breakdown. Model rows contain canonical model ID or `unknown`, observed aliases
where useful, and metrics. Daily rows contain `date: YYYY-MM-DD | null` and metrics. The endpoint
does not add initial date filters; clients receive the complete history.

An issue with no current sessions returns the normal not-found envelope even if its Linear cache
row exists. Running/failed imports never leak partial facts: repositories read only committed rows
and response state explains a retained prior snapshot.

Alternative: place issue usage under the existing session endpoint. Rejected because issue list
and detail are first-class resources with different pagination and breakdown needs.

### 6. Return phase only as metadata

Phase is copied from the current attribution/session metadata into each session breakdown and is
not normalized, enumerated, or grouped. This avoids quietly promoting `explore`, `apply`, and
`verify` examples into architecture. A later phase-aggregation change can define grouping and
historical semantics separately.

## Risks / Trade-offs

- [Query-time aggregation slows with large histories] → Use fact-table indexes, bounded issue
  pagination, shared SQL projections, and repository integration benchmarks before considering
  materialization.
- [Nullable categories complicate clients] → Generate explicit nullable OpenAPI fields and pair
  them with completeness flags and anomaly codes.
- [Daily session counts are easy to sum incorrectly] → Document them as non-additive in schema
  descriptions and test one session spanning multiple days.
- [Latest cost generation lags usage] → Join costs by observation identity and mark uncovered facts
  cost-incomplete rather than mixing generations.
- [Current relink rewrites all-time attribution conceptually] → Keep the behavior explicit in API
  docs and defer historical attribution to a separate capability.

## Migration Plan

1. Add response models and repository projections behind tests without modifying existing session
   or Linear endpoints.
2. Add query services and authored tsoa controllers for list/detail operations.
3. Regenerate backend routes/OpenAPI and the frontend RTK Query client in one root API-generation
   step; do not hand-edit generated outputs.
4. Verify list/detail behavior against representative DuckDB fixtures, including relinks and
   incomplete generations.

Rollback removes the new authored controllers/query paths and regenerates the contract. No source
facts, attribution, cost generations, or Linear data require migration or reversal.
