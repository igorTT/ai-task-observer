## Context

See [proposal.md](proposal.md) for motivation. The overview consumes one generated
`GET /api/usage/timeline` response for selected-range totals, UTC-hour buckets, completeness,
warnings, unknown-time count, and cost-generation provenance. The active
`filter-usage-overview-by-session-phase` change makes that same fact population optionally depend
on a current session assignment.

Usage observations already retain an exact observed model and normalized token categories. A
completed cost item retains the observed model, its resolved canonical model when known, exact cost
components, completeness, and gaps. The server also loads the validated current pricing catalog at
startup. No persisted schema change is needed, and API types must continue to flow from authored
tsoa models through generated OpenAPI and the generated RTK Query client.

## Goals / Non-Goals

**Goals:**

- Produce one deterministic model partition of exactly the selected known-time timeline facts.
- Keep token totals queryable when a completed cost generation is missing, stale, or incomplete.
- Preserve completed-generation canonical and cost provenance while providing an exact-catalog
  identity fallback for uncovered observations.
- Reuse existing metric exactness, completeness, warnings, request-state, and accessibility
  conventions.
- Compose cleanly with the active phase filter and the separate phase-comparison proposal.

**Non-Goals:**

- Change stored observations, cost items, pricing catalog structure, or DuckDB ownership.
- Make observed model strings part of the new public breakdown or expose pricing internals.
- Add model selection, time series, token-category detail, or issue-detail behavior.
- Recalculate cost or make a timeline read mutate operational state.

## Decisions

### 1. Add model entries to the existing timeline response

Add a `models` collection to the authored timeline response. It is calculated from the same
captured cutoff and selected fact set as `totals` and `buckets`, and is returned by the same request.
Each entry contains a model key plus the same exact total-token, estimated-cost, completeness, and
warning shape needed by the existing metrics.

A separate model-usage endpoint was rejected because two requests could observe different cutoffs,
phase assignments, committed revisions, or cost generations. Frontend aggregation was rejected
because the response deliberately does not expose observation facts and JavaScript must not
reconstruct exact backend accounting.

This response addition is independent of the proposed all-phase comparison collection. If both
changes are applied, authored models are merged first and generated artifacts are regenerated once;
neither collection reads or derives values from the other.

### 2. Partition the selected fact stream once

Extend the timeline fact projection with observed model and joined cost-item canonical model. Apply
the range and current-phase predicates before both overall and per-model aggregation, then partition
that already selected in-memory fact stream by resolved model key. Reuse the current exact metric
builder for each partition so token nullability, partial cost, completeness, and warning unions do
not drift from overall totals or buckets.

Issuing one aggregate SQL query per model was rejected because the model set is dynamic and would
repeat range and phase scans. Reusing issue-detail model queries was rejected because they require a
current Linear link, include all time, and currently collapse missing generation identity directly
to unknown, while the overview must include linked and unlinked selected-range usage.

Known model keys sort by canonical identifier and the reserved `unknown` key sorts last. Only
non-empty partitions are returned. This matches the existing issue-detail convention, avoids
hard-coded zero rows, and keeps ordering deterministic without converting exact totals to
JavaScript numbers for sorting.

### 3. Resolve identity with generation provenance first and catalog fallback second

For each selected observation, determine its bucket in this order:

1. Use the non-null `canonical_model` from its joined item in the selected completed generation.
2. Otherwise, look up the observation's exact model string in the loaded current catalog's canonical
   and alias index and use that canonical ID.
3. Otherwise, use the reserved `unknown` key.

The lookup resolves identity only; it does not select a price period or calculate cost. Thus the
`gpt-5.6` alias can contribute tokens to `gpt-5.6-sol` without completed cost coverage, while Terra
and future configured models appear dynamically. Existing cost fields still come exclusively from
the selected completed generation. A covered item with a null canonical model may therefore gain a
current-catalog token identity while retaining its unavailable historical cost and warnings.

Using only cost items was rejected because a missing generation would make every token observation
unknown even though the validated catalog can identify it. Using only the current catalog was
rejected because it could relabel completed historical cost after alias/catalog changes and detach
the entry from the generation that supplied its cost. Returning arbitrary observed strings as
separate public buckets was rejected because aliases would fragment canonical usage and unknown
model cardinality could grow without bound.

The query service receives the already loaded catalog (or an immutable exact identity resolver)
from server composition; timeline reads do not reload configuration. The repository remains
read-only and the backend remains the sole DuckDB owner.

### 4. Preserve token and cost completeness independently per model

Per-model `totalTokens` follows current timeline semantics: it is exact when every observation in
that partition has complete normalized totals, otherwise null/unavailable. It is never suppressed
because model cost is missing. Per-model cost sums independently known selected-generation values,
is partial when only some contributing cost is known, and is unavailable when none is known.
Observation anomalies, pricing gaps, uncovered-generation state, and derived incomplete/unavailable
warnings are unioned and sorted within that model partition.

Returning known-partial token sums was rejected because it would conflict with current overall and
hourly token semantics. Hiding an entire incomplete row was rejected because it would conceal known
cost and the existence of selected usage. Adding a second generation or live price calculation as a
fallback was rejected because one response must retain a single auditable cost provenance.

### 5. Render a semantic table/card from backend entries

Add one Recent model usage card containing a semantic table with Model, Total tokens, and Estimated
cost. Canonical IDs remain the authoritative displayed identity; `unknown` is presented as
"Unknown model." Existing exact formatters provide compact visible values while the unrounded
decimal string remains available through labels/title text. Each row exposes complete, partial,
unavailable, and known-zero state plus sanitized warnings.

The table uses the timeline query's existing initial-loading, cached-refresh, failure/retry, empty,
range, and phase behavior. A chart was rejected because exact comparison, unknown/partial state,
and a dynamic model set are clearer and more accessible in a compact table. A fixed Sol/Luna card
pair was rejected because Terra, unknown, and future configured models must appear when used.

## Risks / Trade-offs

- [A stale generation and changed current alias catalog can place related observations in different
  canonical buckets] → Prefer retained generation identity for covered items, use current catalog only
  as fallback, and keep stale coverage and row warnings visible until recalculation stabilizes the
  generation.
- [Adding a catalog dependency to timeline composition broadens the query service boundary] → Pass
  the immutable catalog already validated at startup and keep price calculation out of the read path.
- [Incomplete observations make a model's total tokens unavailable even when some tokens are known]
  → Preserve the established conservative token semantics and expose row warnings rather than a
  misleading partial number.
- [The model collection increases response and rendering size] → Return only buckets with usage;
  the expected configured model cardinality is small and no observation records are exposed.
- [Concurrent phase-comparison work touches the same authored and generated files] → Keep the
  contracts additive and independently tested, then compose authored changes before running the
  root generation command; never hand-edit generated outputs.

## Migration Plan

1. Extend timeline facts, domain records, and aggregation with provenance-first model partitioning
   and the immutable current-catalog identity fallback.
2. Thread the catalog through server composition and extend the authored timeline response model.
3. Regenerate tsoa routes, OpenAPI, and the frontend client through `npm run generate:api`.
4. Add the overview model table/card and focused backend, contract, frontend, and browser coverage.
5. Verify phase-filtered and unfiltered ranges, linked and unlinked usage, aliases, Terra, unknown
   models, unknown time, incomplete tokens, missing/stale cost, exact values, and cached refresh.

No database migration or data backfill is required. Rollback removes the additive response field,
catalog resolver wiring, and overview presentation; stored observations and cost generations remain
valid and unchanged.
