## Why

The recent-usage overview shows how many tokens and how much configured cost were consumed, but it
cannot show which models contributed that usage. A range- and phase-aware model breakdown will make
the global overview useful for comparing model consumption without requiring a Linear issue link.

## What Changes

- Extend the usage-timeline response with a dynamic model breakdown calculated from the same
  selected 12h or 24h window, captured cutoff, current session-phase filter, committed facts, and
  latest completed cost generation as the existing overview totals and hourly buckets.
- Return one entry for each model bucket that has selected-range usage, including all configured
  canonical models such as `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`, plus one explicitly
  labeled unknown bucket when applicable; do not hard-code a Sol/Luna-only response shape.
- Keep token grouping available when cost coverage is stale or missing by preferring canonical
  identity from a completed cost item, then exact current-catalog model/alias resolution, and then
  the unknown bucket. Preserve cost-generation provenance and partial/unavailable cost state
  independently for each entry.
- Add an accessible overview table/card with Model, Total tokens, and Estimated cost columns,
  exact-value presentation, deterministic ordering, and visible completeness or warning state.
- Exclude observations without source timestamps from the range-bound breakdown just as the
  existing timeline excludes them from range totals and buckets; retain the existing separate
  unknown-time notice.
- Non-goals: new ranges, an all-time breakdown, model filtering or comparison controls, model
  charts, token-category columns, developer-turn or session counts, issue-detail redesign, pricing
  catalog editing, cost recalculation, persistence changes, or a database migration.
- Dependencies: this change depends on `filter-usage-overview-by-session-phase` for the current
  phase selector and phase-aware timeline population. It remains independent of
  `compare-usage-overview-by-session-phase`; if both changes proceed, their additive response and
  overview edits must be composed through the generated API workflow without making either metric
  depend on the other.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-timeline-aggregation`: Return exact, range- and phase-aware model usage entries with
  deterministic canonical/unknown identity, token completeness, and independently derived cost
  completeness and warnings.
- `usage-dashboard`: Present the returned model breakdown on the overview in an accessible dynamic
  table/card synchronized with the existing range, phase, request, and refresh states.

## Impact

- The authored usage-timeline domain and tsoa response models gain a model collection, requiring
  generated routes, OpenAPI, and frontend RTK Query client regeneration.
- The timeline repository/query service reuse stored observation models, normalized tokens, joined
  completed cost items, and the loaded pricing catalog; no persisted schema or usage facts change.
- The overview gains model-breakdown presentation and exact formatting plus empty, incomplete,
  unknown-model, stale/missing-cost, loading, and cached-refresh coverage.
- Backend repository, query-service, HTTP, generated-contract, frontend generated-client,
  presentation, overview feature, and browser-flow tests are affected.
