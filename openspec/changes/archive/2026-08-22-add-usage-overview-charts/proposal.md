## Why

The existing dashboard explains usage by linked Linear issue but does not provide a time-based
view of total imported Codex consumption. A dedicated overview with trustworthy token and cost
trends is needed so a developer can quickly understand recent activity before drilling into issue
attribution.

## What Changes

- Add a global usage-timeline API that aggregates all committed Codex usage observations,
  including observations from sessions without a committed Linear issue link.
- Return backend-calculated total tokens, configured API-equivalent estimated cost, completeness,
  cost-generation coverage, and ordered hourly buckets for `12h` and `24h` rolling ranges.
- Add a dedicated `/overview` dashboard route and make it the application landing page while
  retaining the existing issue and session routes.
- Add a shared `12 hours` / `24 hours` segmented range selector that defaults to `12 hours`, stores
  non-default selection in URL state, and controls both totals and charts together.
- Display selected-range token and estimated-cost counters plus synchronized, responsive Recharts
  bar charts with client-local time labels, exact-value tooltips, and visible incomplete or
  unavailable states.
- Preserve exact decimal-string metrics at the HTTP boundary and keep all aggregation,
  completeness, and pricing-generation decisions in the backend.
- Add backend, generated-contract, frontend, route, accessibility, and chart-presentation tests.
- Dependencies: the implemented `project-foundation`, `codex-session-ingestion`,
  `session-usage-events`, `session-cost-estimation`, and `usage-dashboard` capabilities provide the
  persisted facts, immutable pricing generations, generated API boundary, and routed shell.
- Non-goals: week or month ranges; arbitrary date ranges or bucket sizes; issue, model, session, or
  token-category filters; stacked token-category charts; live streaming; changing pricing or
  token-normalization semantics; presenting estimates as billed spend; changing issue usage
  aggregation; or supporting dashboard layouts below the existing 1024 CSS pixel minimum.

## Capabilities

### New Capabilities

- `usage-timeline-aggregation`: Global rolling-range token and cost totals, hourly buckets,
  completeness, generation coverage, and generated HTTP resources for all imported usage.

### Modified Capabilities

- `usage-dashboard`: Add the overview route, default-12-hour range selector, selected-range
  counters, synchronized Recharts visualizations, and associated loading, error, empty, and
  accessibility behavior.

## Impact

- Backend additions affect an authored usage-timeline repository/query service, API response
  models and controller, dependency wiring, and mirrored tests; no database migration is expected.
- The authored tsoa contract changes, so backend routes/OpenAPI and the frontend RTK Query client
  will be regenerated and committed separately from authored files.
- Frontend additions affect application routing/navigation, a new overview feature, shared
  formatting and URL-range utilities, RTK Query endpoint tags, styles, and mirrored tests.
- Recharts becomes a frontend runtime dependency. DuckDB remains backend-owned and the browser
  continues to consume data only through the generated API boundary.
