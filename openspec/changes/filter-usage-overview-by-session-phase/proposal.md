## Why

The recent-usage overview cannot currently answer how many tokens or how much configured cost was
spent on sessions classified as a particular workflow phase. Canonical phase assignment and its
explicit API now provide a stable current-session classification that can safely constrain the
existing backend timeline aggregation.

## What Changes

- Add an optional current-session-phase filter to the usage-timeline API and apply it before
  backend totals, hourly buckets, completeness, warnings, and unknown-time counts are calculated.
- Add a single-select overview control for All, each canonical phase, and Unassigned, with the
  non-default selection represented in URL state alongside the existing range.
- Define phase filtering as current session classification: reassigning a session through the
  explicit phase API intentionally and retroactively moves all of that session's usage between
  phase-filtered views.
- Keep explicit `other` distinct from an unassigned session, and preserve today's global behavior
  when no phase filter is supplied.
- Continue treating the phase mutation API and `session_phase_assignments` as the only phase source
  of truth. Session titles and title suffixes SHALL NOT assign, change, clear, or filter phase.
- Refresh subscribed timeline, session, and issue-usage data after a successful phase mutation
  without triggering import or cost recalculation.
- Non-goals: phase history or phase-at-event accounting, splitting a mixed-work session, multiple
  simultaneous phase selections, phase comparison/grouped charts, new overview metrics, issue-page
  filtering, or frontend phase-editing controls.
- Dependencies: this change depends on the completed `set-session-phase` change for canonical
  persistence, removal of title-derived phases, and `PUT /api/sessions/{sessionId}/phase`. It does
  not depend on Linear attribution state, and should follow the completed overview-table change
  `show-recent-exact-buckets-first` to avoid overlapping edits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-timeline-aggregation`: Allow recent totals, hourly buckets, completeness, warnings, and
  unknown-time observation counts to be constrained by one current session-phase selection.
- `usage-dashboard`: Add shareable current-session-phase selection to the recent-usage overview and
  keep every overview value synchronized with the selected range and phase.

## Impact

- The authored tsoa timeline query/response contract gains a current-session-phase filter, requiring
  generated routes, OpenAPI, and frontend RTK Query client regeneration.
- The DuckDB timeline repository joins canonical phase assignments by session ID before aggregation;
  no persisted usage facts, cost generations, or phase data require migration.
- Overview URL-state helpers, selector UI, timeline query arguments, accessibility copy, and focused
  frontend tests change.
- The authored RTK Query enhancement layer adds phase-mutation invalidation for session,
  issue-usage, and timeline caches.
- Backend repository, query-service, HTTP, generated-contract, frontend API-cache, feature, and URL
  regression coverage is affected.
