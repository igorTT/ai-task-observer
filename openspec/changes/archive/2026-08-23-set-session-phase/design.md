## Context

See [proposal.md](proposal.md) for motivation. Today `phase` is an optional free-form column on
`linear_session_attributions`. The title parser extracts it from text after a colon, and every
attribution state transition copies or replaces it. Session and issue-usage queries expose that
column. This couples workflow classification to Linear reconciliation and allows concurrent or
later imports to overwrite phase metadata.

The backend must remain the only DuckDB writer, and request and response types must continue to
flow through the authored tsoa contract into generated OpenAPI and frontend code.

## Goals / Non-Goals

**Goals:**

- Give phase assignments one explicit writer and lifecycle independent of Linear attribution.
- Enforce one canonical vocabulary consistently at the API, domain, and database boundaries.
- Preserve existing issue-title compatibility while removing title-derived phase behavior.
- Make the persisted representation safe for later `GROUP BY phase` queries.

**Non-Goals:**

- Compute phase aggregates, expose phase statistics, or add phase filters.
- Add frontend editing controls.
- Preserve arbitrary legacy phase text alongside the `other` bucket.
- Model phase history or enforce workflow transitions between phases.

## Decisions

### 1. Store explicit phase assignments separately from Linear attribution

Add a `session_phase_assignments` table keyed by `session_id`, with a `VARCHAR` phase column and a
database `CHECK` constraint for `research`, `explore`, `proposal`, `apply`, `verify`, `quick-flow`,
and `other`. No row means unassigned. The phase repository owns writes to this table; attribution
reconciliation and relinking never write it.

Session-detail and issue-usage queries read or left-join the assignment. This makes title imports,
Linear synchronization, relinking, and phase mutation independent and eliminates stale full-row
attribution saves overwriting a recent phase update.

Alternatives considered:

- Keep phase on `linear_session_attributions` and exclude it from reconciliation updates. This is
  a smaller schema change, but assignment would still depend on an attribution row and ownership
  would remain easy to violate in future full-row saves.
- Use a native DuckDB enum. A constrained string retains clear persisted values while allowing a
  later additive migration to expand the vocabulary without replacing a database enum type.

### 2. Use an idempotent phase resource operation

Add `PUT /api/sessions/{sessionId}/phase` with an authored request body whose `phase` is the
canonical union or `null`. A canonical value upserts the assignment; null deletes it. The response
contains the updated session attribution, matching the shape clients already consume after a
relink. Unknown sessions return 404 and unsupported values return the standard tsoa validation
response without a write.

The operation is idempotent: repeating the same assignment or clear request produces the same
stored state. A dedicated phase service verifies the session, performs the repository mutation,
and re-queries the session view for the response.

Alternatives considered:

- `PATCH /api/sessions/{sessionId}` would combine unrelated mutable fields before the application
  has a general session-update contract.
- Encoding clear as a special enum value would collapse “unassigned” into a reporting category;
  null keeps absence distinct from the deliberate `other` bucket.

### 3. Keep title suffix compatibility but remove its phase semantics

The parser continues accepting either an exact issue identifier or an identifier followed by a
colon and arbitrary suffix text. It returns only the normalized candidate identifier. Therefore
existing titles such as `ENG-215: apply` remain attributable to `ENG-215`, but `apply` neither
assigns nor changes phase. Attribution state transitions obtain phase only from the separate phase
assignment read path.

Rejecting every existing colon-suffix title was considered, but it would unnecessarily unlink
current candidates while delivering no additional integrity for explicit phase assignment.

### 4. Define the vocabulary once and project it through generated contracts

Introduce a domain `SessionPhase` string union and use it in persistence models, API request and
response models, and query results. The database constraint independently protects stored data.
API regeneration publishes the same allowed values to the frontend client.

`other` is a real explicit category. It does not carry a custom label. This keeps aggregation
bounded while providing a deliberate fallback when none of the named workflow stages applies.

### 5. Canonicalize legacy data once during migration

The migration creates the assignment table and copies each non-null attribution phase into it.
Exact canonical strings are copied unchanged; all other non-empty strings become `other`. Nulls
create no assignment. After queries and models stop reading the legacy column, the migration drops
that column so there is no second phase source of truth.

The conversion deliberately avoids inferred synonym mappings. For example, `review` does not
silently become `verify`; it becomes `other` because only the user can choose the intended stage.

## Risks / Trade-offs

- [Legacy custom phase detail is lost when mapped to `other`] → Document the destructive mapping
  in the migration and test it with canonical, custom, and null values.
- [Dropping the legacy column makes binary rollback across the migration unsafe] → Back up the
  local DuckDB file before deployment; rollback restores that backup with the previous binary.
- [Clients may still expect titles to assign phases] → Retain issue-candidate compatibility and
  update backend documentation and contract tests to make explicit assignment clear.
- [A fixed enum may need expansion] → Use a string union plus a database check so additions are an
  explicit API and SQL migration rather than an opaque free-form value.
- [`research` and `explore` may be used inconsistently] → Treat vocabulary semantics as a product
  convention; future UI copy can explain them without weakening backend validation.

## Migration Plan

1. Back up the existing DuckDB file before deploying the migration.
2. Create the constrained phase-assignment table and copy canonicalized legacy phase data within
   the normal migration transaction.
3. Update authored reads and writes to use the new table, then regenerate API artifacts.
4. Drop the legacy attribution phase column in the same migration after the copy succeeds.
5. Verify canonical, custom, and null legacy rows plus phase assignment, replacement, clearing,
   invalid input, missing sessions, title reconciliation, and relinking.

Rollback requires restoring the pre-migration DuckDB backup before starting the previous binary.

