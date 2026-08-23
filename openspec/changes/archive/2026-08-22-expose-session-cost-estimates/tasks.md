## 1. Session Cost Projection

- [x] 1.1 Add an authored session-cost summary model and a read-only repository query that batches
  requested session IDs against the deterministic latest completed generation, preserving exact
  decimal estimates, completeness, sorted pricing gaps, and `uncovered_generation` coverage.
- [x] 1.2 Add repository fixtures and tests for linked and unlinked sessions with complete, partial,
  unavailable, missing-generation, stale/uncovered-generation, and no-usage states, including
  agreement with established issue-usage cost semantics.

## 2. Authored Session API

- [x] 2.1 Extend the authored session response and query-service view with `estimatedCostUsd`,
  `costComplete`, and `pricingGapCodes`; batch list-page cost reads, use the same projection for
  detail, and wire the repository through production and test composition roots.
- [x] 2.2 Update backend query-service and HTTP tests to verify list/detail agreement, decimal-string
  serialization, complete and partial estimates, unavailable cost, uncovered observations, and
  requests made without a completed generation.

## 3. Generated API Artifacts

- [x] 3.1 Run `npm run generate:api` and commit the generated backend routes/OpenAPI and frontend RTK
  Query client changes separately from authored edits.
- [x] 3.2 Run generated-file verification and confirm the three required session fields appear in
  both list and detail response types without hand-editing generated files.

## 4. Session Page

- [x] 4.1 Display the returned estimated cost with existing USD formatting and replace the
  hardcoded null/false/empty cost state with generated response values.
- [x] 4.2 Add frontend regression tests for complete, partial with visible pricing gaps, unavailable,
  and numeric-zero estimates so null is never rendered as zero and complete sessions are not
  labeled partial.

## 5. Verification

- [x] 5.1 Run focused backend repository, service, and HTTP tests plus focused frontend session-page
  tests.
- [x] 5.2 Run formatting, lint, type checks, and builds for both workspaces, then run the full test
  suite and resolve any stale typed fixtures caused by the additive required API fields.
