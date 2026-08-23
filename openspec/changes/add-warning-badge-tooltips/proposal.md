## Why

Usage metric panels currently spend visual attention confirming healthy token and cost state while
warning labels expose terse internal codes without explaining what they mean. Showing badges only
when attention is needed, with reusable accessible explanations, makes exceptional states easier
to understand without repeating tooltip logic throughout the dashboard.

## What Changes

- Remove healthy “Tokens complete” and “Cost complete” badges from shared usage metric state.
- Continue showing partial-token, partial-cost, unavailable-cost, anomaly, and pricing-gap badges
  whenever those warning conditions are present.
- Give every usage warning badge a concise human-readable explanation available on pointer hover
  and keyboard focus.
- Add reusable tooltip primitives and a reusable warning-badge composition rather than embedding
  one-off tooltip markup in each feature.
- Centralize known usage-warning descriptions and provide a sanitized fallback for future or
  unknown warning codes.
- Add accessibility and rendering regression coverage for healthy, warning, and unknown-code
  states.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Present usage metric badges only for warning states and explain each warning
  through an accessible tooltip.
- `codex-session-ingestion`: Stop labeling complete session cost with a success badge while keeping
  the returned estimate and exposing explained warnings for incomplete cost.

## Non-goals

- Changing backend completeness, anomaly, pricing-gap, or estimated-cost semantics.
- Hiding the estimated cost or other metric values when warnings exist.
- Reworking attribution, operational-status, import-state, or other non-metric badges.
- Adding interactive remediation actions inside tooltips.

## Dependencies

- Depends on the existing shared metric-state rendering and session-cost response fields.
- Adds the Radix tooltip primitive used by the project’s shadcn-style UI layer; no backend,
  database, or generated API changes are required.

## Impact

- Shared frontend UI primitives and usage warning presentation.
- A centralized warning-description catalog covering current token anomalies and pricing gaps.
- Issue and session views that consume shared usage metric state.
- Frontend dependencies, lockfile, and focused component tests.

