## 1. Backend Timeline Domain and Persistence Query

- [x] 1.1 Add authored recent-usage range, bucket, aggregate, generation-provenance, and response-domain types with an injectable clock and explicit `12h`/`24h` definitions.
- [x] 1.2 Implement the read-only DuckDB timeline repository query over committed usage observations with a bound generation ID, exact half-open range filtering, clipped UTC-hour buckets, zero filling, unknown-time counting, and existing token/cost completeness semantics.
- [x] 1.3 Add repository fixtures and tests covering 12/24-hour boundaries, first and last partial buckets, exact-boundary assignment, empty hours and ranges, linked plus unlinked sessions, unknown timestamps, missing generations, uncovered observations, and partial cost.

## 2. Backend Query Service and Authored API Contract

- [x] 2.1 Implement the timeline query service so one request captures a single cutoff and cost-status snapshot, selects one completed generation, invokes the repository consistently, and maps exact decimal strings plus current/stale/missing coverage without triggering mutations.
- [x] 2.2 Add query-service tests for the default 12-hour range, explicit 24-hour range, generation provenance, token availability without pricing, stale coverage, and sanitized unknown-time and warning propagation.
- [x] 2.3 Add authored tsoa response models and a read-only usage-timeline controller with omitted-range defaulting and documented validation for unsupported values, then wire the service through API and server dependencies.
- [x] 2.4 Add HTTP tests for successful default and explicit ranges, unsupported-range errors, empty and incomplete responses, all-session population, and the absence of source paths, raw records, message content, reasoning, tool data, or credentials.

## 3. Generated API Artifacts

- [x] 3.1 Run the root API generation command after the authored contract is complete and commit the regenerated backend routes, OpenAPI document, and frontend RTK Query client as a separate generated-file step.
- [x] 3.2 Extend generated-client contract tests for the timeline request parameters and response shape, then run generated-file and alias verification.

## 4. Frontend Timeline Data and Range State

- [x] 4.1 Add Recharts to the frontend workspace dependency manifest and lockfile without introducing a second charting abstraction or unrelated visualization packages.
- [x] 4.2 Enhance the generated timeline endpoint with a `UsageTimeline` cache tag and update rescan and recalculation invalidation plus bounded import/cost terminal-transition refresh behavior without idle polling.
- [x] 4.3 Add a URL-range utility and accessible segmented selector that treat parameter absence or invalid values as canonical `12h`, write only the non-default `24h` value, and restore selection through browser history.
- [x] 4.4 Add exact local-time interval formatting and one presentation-data adapter that retains raw token/USD strings, supplies validated finite plot values, and shares labels and completeness across counters, charts, tooltips, and accessible data.
- [x] 4.5 Add focused tests for URL canonicalization, default selection, browser-history restoration, local interval formatting, exact-value retention beyond JavaScript safe integer precision, and unplottable finite-conversion fallback.

## 5. Overview Counters, Charts, and Routing

- [x] 5.1 Build the overview page with selected-range total-token and configured estimated-cost counters, explicit duration labels, generation coverage, unknown-time warning, and complete, partial, unavailable, and known-zero states from backend totals.
- [x] 5.2 Build synchronized responsive Recharts token and estimated-cost bar charts using the shared bucket data, client-local tooltips, clipped interval labels, reduced-motion behavior, and non-color-only incomplete or unavailable treatments.
- [x] 5.3 Add explicit chart titles and descriptions plus one screen-reader-accessible ordered data table containing exact intervals, values, and completeness for keyboard and assistive-technology use.
- [x] 5.4 Add `/overview`, redirect the root and product brand to it, add Overview to primary navigation, and retain direct compatibility for the existing issue and session routes.
- [x] 5.5 Implement initial loading, cached refresh, empty success, stale/missing cost, sanitized failure, and retry presentation while keeping meaningful prior data and range controls available where possible.

## 6. Frontend and End-to-End Verification

- [x] 6.1 Add overview feature tests using the generated RTK Query boundary for default 12-hour loading, 24-hour switching, shared counter/chart updates, complete and partial data, empty buckets, missing cost, request failure, retry, and background refresh.
- [x] 6.2 Add route and shell tests for root-to-overview navigation, active primary navigation, canonical URL range behavior, direct issue/session compatibility, and the supported 1024 CSS pixel desktop layout without page-level horizontal overflow.
- [x] 6.3 Add accessibility-focused tests for segmented-control keyboard behavior, chart names and descriptions, exact accessible bucket rows, synchronized interval inspection, live refresh state, and reduced-motion handling without relying on SVG snapshots.
- [x] 6.4 Extend the Playwright critical flow to open the overview, verify the 12-hour default, switch to 24 hours, and observe both counters and charts updating from one timeline response.

## 7. Final Verification

- [x] 7.1 Run focused backend and frontend formatting, lint, type checking, and tests for the new timeline and overview modules and resolve all failures.
- [x] 7.2 Run the complete repository verification pipeline, including generated-file checks, all tests, builds, and backend smoke verification, and confirm no database migration or unrelated generated changes are present.
