## Why

Filtering the overview to one current session phase answers how much that phase consumed, but it
removes the all-phase context needed to judge whether that amount is large or small. The overview
should make selected-phase estimated cost comparable with total spend and every other phase in the
same rolling range.

## What Changes

- Extend the usage-timeline response with one all-phase cost comparison calculated for the same
  captured 12h or 24h window and latest completed cost generation as the selected timeline.
- Return one deterministic comparison entry for every canonical current session phase plus
  Unassigned, and an authoritative all-phase total, independently of the optional selected-phase
  filter.
- Add an estimated-cost donut chart to the overview. When a phase is selected, emphasize its slice
  and show its exact amount, share of all-phase cost, and the amounts for the other phases; when All
  is selected, show the complete distribution and all-phase total.
- Preserve exact decimal-string values, current-session-assignment semantics, the distinction
  between explicit `other` and Unassigned, and visible partial/unavailable cost states.
- Keep the phase comparison synchronized with the existing range and phase controls, cached refresh
  behavior, cost-generation status, and accessible non-pointer presentation.
- Non-goals: comparing tokens or developer turns, phase-at-event history, inferred or mixed-session
  phases, user-selectable comparison metrics, issue-page comparison, multiple selected phases, or
  replacing the existing hourly token and cost charts.
- Dependencies: this follow-on depends on `filter-usage-overview-by-session-phase` for canonical
  current-phase filtering, overview URL state, and phase-aware cache invalidation, and on the
  completed `set-session-phase` change for explicit phase assignments.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-timeline-aggregation`: Return a deterministic all-phase estimated-cost comparison from the
  same range, cutoff, facts, and cost generation as the requested timeline.
- `usage-dashboard`: Present the selected phase against all-phase cost and each other phase in an
  accessible donut comparison while preserving exactness and completeness state.

## Impact

- The authored timeline domain and response contract gain all-phase comparison totals and entries,
  requiring generated tsoa routes, OpenAPI, and frontend RTK Query client regeneration.
- The DuckDB timeline repository and query service aggregate one shared fact population by current
  session assignment without adding persisted data or a migration.
- The overview gains a Recharts donut presentation, exact comparison labels, empty/partial/
  unavailable states, responsive styling, and focused accessibility coverage.
- Backend repository, query-service, HTTP, generated-contract, frontend presentation, overview
  feature, and browser-flow tests are affected.
