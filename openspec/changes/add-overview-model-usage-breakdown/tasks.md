## 1. Backend Model Identity and Aggregation

- [ ] 1.1 Add a pure timeline model-identity resolver that prefers the selected completed item's
  non-null canonical identity, falls back to exact canonical/alias lookup in the immutable loaded
  pricing catalog, and otherwise returns the reserved `unknown` key without price calculation.
- [ ] 1.2 Extend the selected timeline fact projection and domain records with observed/canonical
  model identity and build deterministic non-empty model partitions from the same range- and
  current-phase-filtered known-time facts used by totals and hourly buckets.
- [ ] 1.3 Reuse the exact timeline metric builder for each model partition so normalized token
  completeness remains independent from latest-generation cost values, coverage, completeness,
  pricing gaps, and warnings.
- [ ] 1.4 Add repository/domain regression coverage for linked and unlinked sessions, All and each
  selected phase mode, range boundaries, unknown-time exclusion, empty ranges, exact overall
  reconciliation, deterministic ordering, and no duplicate observation membership.
- [ ] 1.5 Add identity and metric coverage for canonical items, the `gpt-5.6` Sol alias, Sol, Terra,
  Luna, a future configured model, multiple observed unknowns in one bucket, incomplete tokens,
  unpriceable models, and current, stale, partially covered, and missing cost generations.

## 2. Authored Timeline Service and HTTP Contract

- [ ] 2.1 Thread the already validated immutable pricing catalog or exact identity resolver through
  server composition into the timeline query path without reloading configuration, writing DuckDB,
  or triggering cost recalculation.
- [ ] 2.2 Extend the authored timeline response model and query-service mapping with ordered model
  entries containing the canonical-or-unknown key, exact decimal-string token/cost values, separate
  completeness state, and sanitized warnings while retaining one cutoff and cost generation.
- [ ] 2.3 Add query-service, server-composition, and Supertest coverage for unfiltered and
  phase-filtered responses, alias fallback with missing/stale coverage, unknown identity, exact
  serialization, empty collections, preserved generation provenance, and sanitized query failure.

## 3. Generated API Boundary

- [ ] 3.1 After composing all accepted authored timeline additions, run `npm run generate:api` to
  regenerate tsoa routes, OpenAPI, and the frontend RTK Query client; do not hand-edit generated
  files.
- [ ] 3.2 Extend generated-contract and frontend generated-client tests to prove the dynamic model
  array shape, exact string/null values, completeness and warning fields, phase query
  serialization, and compatibility with any independently accepted phase-comparison additions.

## 4. Overview Model Usage Presentation

- [ ] 4.1 Add a semantic Recent model usage table/card with Model, Total tokens, and Estimated cost
  columns that consumes only backend-returned entries, preserves deterministic order and exact
  values, and labels the reserved key as Unknown model.
- [ ] 4.2 Present complete, partial, unavailable, known-zero, and sanitized warning state per row
  while retaining independently available tokens during stale or missing cost coverage and showing
  a successful empty state for an empty model collection.
- [ ] 4.3 Integrate the table with the existing range, current-phase, initial-loading,
  cached-refresh, failure/retry, responsive-layout, and accessible non-pointer behavior without
  adding model controls or a second request.
- [ ] 4.4 Add focused presentation and overview tests for Sol/Terra/Luna plus dynamic future models,
  unknown model, exact large token and decimal cost values, phase and range changes, incomplete
  rows, stale/missing cost, empty success, cached refresh failure, keyboard semantics, and warning
  labels.
- [ ] 4.5 Extend the overview browser flow to verify the returned model table stays synchronized
  with range and phase URL state and introduces no supported-desktop horizontal overflow.

## 5. Verification

- [ ] 5.1 Run focused backend timeline repository/domain, query-service, server/API, and generated
  contract tests plus focused frontend generated-client, presentation, overview, and browser tests.
- [ ] 5.2 Run root generated-file verification, formatting, linting, type checks, the full test
  suite, production builds, and smoke verification, resolving regressions without adding a schema
  migration, issue-detail redesign, model filter/chart, or live cost calculation.
