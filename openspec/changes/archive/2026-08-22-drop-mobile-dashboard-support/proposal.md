## Why

AI Task Observer is a local desktop companion, so maintaining a separate narrow-screen presentation
adds UI state, styling, and browser-test cost without serving the supported product context. The
dashboard should instead have an explicit desktop-only contract and concentrate verification on
the environment in which it is intended to run.

## What Changes

- **BREAKING**: End support for dashboard viewports narrower than 1024 CSS pixels; behavior below
  that width is unspecified and untested.
- Replace the collapsible narrow-screen navigation with persistent desktop navigation.
- **BREAKING**: Remove the compact/comfortable density control and locally stored density
  preference; the dashboard will use one fixed presentation based on the current comfortable
  spacing.
- Remove narrow-screen table stacking and intentional mobile adaptations while retaining desktop
  overflow safety and ordinary layout resilience at supported widths.
- Replace mobile browser coverage and documentation with desktop viewport coverage and an explicit
  minimum supported width.
- Preserve keyboard navigation, assistive-technology behavior, complete metric presentation, and
  all existing frontend data and privacy boundaries on supported desktop viewports.
- Dependency: the archived `build-usage-dashboard` change supplies the `usage-dashboard`
  capability and current responsive implementation being narrowed by this change.
- Non-goals: blocking access from mobile user agents, rendering a special unsupported-device page,
  changing backend or generated API contracts, redesigning dashboard information architecture,
  introducing another display-density system, or weakening accessibility requirements.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Replace the narrow-and-wide responsive presentation requirement with an
  accessible desktop presentation contract for viewports of at least 1024 CSS pixels and remove
  the local density preference.

## Impact

- Authored frontend shell, shared styles, and the density-only Zustand store under `frontend/src`.
- Playwright project configuration and desktop end-to-end assertions under `frontend/e2e`.
- Frontend documentation describing supported presentation and browser verification.
- The now-unused Zustand frontend dependency and its lockfile entries will be removed.
- No backend, DuckDB, Linear, OpenAPI, or generated-client changes are expected.
