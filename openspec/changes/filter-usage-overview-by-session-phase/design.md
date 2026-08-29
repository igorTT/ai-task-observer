## Context

See [proposal.md](proposal.md) for motivation. The completed `set-session-phase` change stores one
canonical current assignment per session in `session_phase_assignments`; no row means unassigned,
and `other` is an explicit assignment. `PUT /api/sessions/{sessionId}/phase` is the only phase
writer. Session title parsing now produces only a Linear issue candidate and no phase.

The overview calls `GET /api/usage/timeline` with a `12h` or `24h` range and receives backend totals,
UTC-aligned hourly buckets, completeness, warnings, unknown-time observation count, and cost
generation provenance. The response contains no per-session facts, so exact filtering must happen
before aggregation. API types continue to flow from authored tsoa models through generated OpenAPI
and the generated RTK Query client.

## Goals / Non-Goals

**Goals:**

- Constrain one overview request by one current explicit session-phase classification.
- Preserve exact token/cost and completeness semantics for the selected fact population.
- Keep phase classification independent of title parsing and Linear attribution.
- Make range and phase selection shareable and restorable through URL state.
- Refresh phase-dependent frontend caches after successful explicit phase mutation.

**Non-Goals:**

- Record phase history, infer phase at event time, or split one session across stages.
- Add multiple simultaneous phase selection or comparative phase series.
- Add developer-turn or session-count metrics to the recent overview.
- Add phase filtering to issue pages or add frontend phase-editing controls.

## Decisions

### 1. Define the filter as current session classification

Every observation inherits its session's one assignment at query time. Reassigning a session from
`proposal` to `apply` therefore moves every observation of that session between filtered views,
including historical observations that fall inside the requested rolling window. Clearing the
assignment moves the session to Unassigned.

This matches the intended user ownership model: a session is the classification unit, and mixed
workflow activity inside one session is not corrected by the system. UI copy will say "sessions
currently assigned" so it does not imply historical event-phase tracking.

Adding an effective-dated phase history was rejected because the current assignment table contains
no history and old event phases cannot be reconstructed. Per-event inference from titles was also
rejected: it would restore the ambiguous behavior deliberately removed by `set-session-phase`.

### 2. Filter in the timeline repository before metric calculation

Extend the timeline query input with an optional phase selection. The repository left-joins
`session_phase_assignments` directly by observation `session_id` and applies one of three modes:

- omitted: no phase predicate, preserving the global population;
- canonical phase: assignment equals that phase;
- `unassigned`: no assignment row exists.

The same selection constrains known-time facts and the separate unknown-time count. Existing metric
and bucket builders then receive only selected facts, so excluded incomplete observations cannot
affect token completeness, cost completeness, warnings, or partial values. Range predicates and UTC
bucket boundaries remain unchanged.

Filtering a frontend response or paginated session list was rejected because neither contains the
fact timestamps, cost items, exact completeness inputs, or enough data to rebuild buckets safely.
Joining through Linear attribution was rejected because global timeline membership is intentionally
independent of linked/unlinked state.

### 3. Add a typed single-selection generated contract

Add an optional `sessionPhase` query parameter whose filter vocabulary is the canonical
`SessionPhase` union plus reporting-only `unassigned`. Omission means All. The response echoes the
effective filter as the same union or null for All. Invalid values return the documented 422
validation response.

Single selection is chosen as the smallest independently reviewable UI and API. It also avoids
array serialization, ordering, deduplication, and cache-key questions. A later change can introduce
multi-select with OR semantics if product use requires it.

The explicit `PUT /api/sessions/{sessionId}/phase` remains the only mutation. Timeline queries never
write assignments or trigger background work. Authored controller/model edits are followed by the
normal root API regeneration; generated files are never hand-edited.

### 4. Store overview phase selection in canonical URL state

The frontend URL uses `phase=<canonical|unassigned>` while All is omitted. URL parsing accepts only
the documented values, preserves the independent `range` parameter, and replaces invalid phase
state with All before making a timeline request. Browser navigation therefore restores both
controls and their query cache key.

The overview passes `{ range, sessionPhase }` to the generated timeline hook. Counters, charts,
exact bucket rows, warning state, and unknown-time notice continue to use one response, preventing
cross-filter inconsistencies. Keeping phase as component-only state was rejected because it would
make filtered views unshareable and break back/forward restoration.

### 5. Invalidate phase-dependent cache tags after mutation

Enhance the generated `setPhase` endpoint in the authored dashboard API layer to invalidate
`Sessions`, `IssueUsage`, and `UsageTimeline`. RTK Query then refreshes every actively subscribed
range/phase timeline. Phase mutation does not invalidate cost status or trigger recalculation
because observations and cost generations are unchanged.

### 6. Reuse existing keys and add no migration or index initially

`session_phase_assignments.session_id` is already the primary key, and observations already carry
`session_id`. The local analytical query can use that join without changing persisted data. Phase
is low-cardinality, so adding an index on phase before measuring a problem is unlikely to improve
the scan-driven timeline query. Performance will be covered by existing proportional repository
tests and can be profiled separately if data size warrants it.

## Risks / Trade-offs

- [Users may read current assignment as historical event phase] → Use explicit "currently assigned"
  UI copy and cover retroactive reassignment in specs and tests.
- [Reassignment can make an open filtered view stale] → Invalidate every subscribed timeline plus
  session and issue-usage caches after the generated phase mutation succeeds.
- [Global cost coverage can be stale while a selected slice is fully covered] → Preserve global
  generation provenance while calculating `costComplete` only from selected observations; keep the
  existing distinction visible.
- [Unassigned could be confused with explicit `other`] → Give Unassigned a reporting-only filter
  value and predicate on absence of an assignment row.
- [The phase filter adds a join to range queries] → Use the assignment primary key and avoid a new
  low-selectivity index unless profiling demonstrates a need.

## Migration Plan

1. Extend authored timeline domain, repository, query service, controller, and response models with
   the optional current-session-phase selection.
2. Regenerate tsoa routes, OpenAPI, and the frontend client through `npm run generate:api`.
3. Add canonical frontend URL state, the current-phase selector, query wiring, and mutation cache
   invalidation.
4. Verify unfiltered compatibility, canonical and unassigned filtering, retroactive reassignment,
   title independence, UTC buckets, completeness, generated boundaries, and browser state.

No database migration is required. Rollback removes the optional query/UI behavior; existing phase
assignments, usage facts, and cost generations remain valid and unchanged.
