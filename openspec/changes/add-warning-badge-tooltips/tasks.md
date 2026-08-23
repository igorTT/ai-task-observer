## 1. Reusable Tooltip Pattern

- [x] 1.1 Add `@radix-ui/react-tooltip` as a direct frontend dependency and update the lockfile
  through the package manager.
- [x] 1.2 Implement the shared shadcn-style tooltip provider, root, trigger, portal-content
  primitive and mount its provider at the application boundary.
- [x] 1.3 Implement a generic focusable `WarningBadge` composition using the existing badge and new
  tooltip primitives, with component tests for visible labels plus pointer and keyboard access to
  explanations.

## 2. Usage Warning Descriptions

- [x] 2.1 Add a centralized description catalog for partial tokens, partial estimate, unavailable
  cost, all currently emitted token-anomaly codes, all pricing-gap codes, and
  `uncovered_generation`.
- [x] 2.2 Add catalog tests proving known codes receive their intended fixed explanations and
  unknown or malformed codes receive a generic sanitized explanation without opaque interpolation.

## 3. Warning-only Metric State

- [x] 3.1 Refactor shared metric-state rendering to omit healthy token/cost badges, emit the correct
  partial or unavailable synthetic warnings, de-duplicate API warning codes deterministically, and
  return no badge container when no warnings exist.
- [x] 3.2 Render every metric warning through `WarningBadge` while preserving the existing visible
  sanitized labels and independently associated tooltip explanations.
- [x] 3.3 Update shared metric and session-page tests for a quiet healthy state, partial tokens,
  partial and unavailable cost, multiple independently focusable warnings, unknown-code fallback,
  and continued display of known metric and estimated-cost values.

## 4. Verification

- [x] 4.1 Run focused frontend component, metric-state, and session-page tests, then run frontend
  formatting, lint, type checking, and build checks.
- [x] 4.2 Run the full repository verification suite and confirm no backend or generated API files
  changed as part of this frontend-only change.
