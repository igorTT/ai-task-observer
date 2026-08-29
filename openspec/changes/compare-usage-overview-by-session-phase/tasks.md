## 1. Backend Comparison Domain and Aggregation

- [ ] 1.1 Extend authored timeline domain and API response models with a required cost-only
  comparison total and stable Research-through-Unassigned phase entries, preserving decimal-string,
  completeness, and warning types.
- [ ] 1.2 Change the known-time repository query to classify the full captured range once by current
  explicit assignment, then derive the selected totals/buckets and all-phase comparison from that
  shared fact collection while keeping the selected unknown-time count behavior unchanged.
- [ ] 1.3 Add repository regression coverage for canonical ordering, exact all-phase and selected
  values, explicit Other versus Unassigned, empty phases, title independence, reassignment,
  excluded unknown-time facts, partial estimates, unavailable cost, and complete zero cost.

## 2. Query Service and Authored HTTP Contract

- [ ] 2.1 Map the repository comparison into the timeline response using the same captured window
  and cost generation, including cost-only completeness state and the invariant between a selected
  response total and its matching comparison entry.
- [ ] 2.2 Extend query-service and Supertest coverage for filtered and unfiltered comparisons,
  deterministic response shape, exact decimal strings, partial/unavailable warnings, no-cost
  ranges, and unchanged validation and sanitized-failure behavior.

## 3. Generated API Boundary

- [ ] 3.1 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client through
  `npm run generate:api` after authored contract work is complete; do not hand-edit generated
  artifacts.
- [ ] 3.2 Extend generated-contract and client tests to prove the required comparison object,
  cost-only metric types, stable phase discriminator vocabulary and order, null handling, and exact
  decimal-string preservation.

## 4. Overview Phase-Cost Presentation

- [ ] 4.1 Add a pure comparison presentation helper with stable labels and colors, guarded numeric
  plot values, rounded shares based on the authoritative total, and explicit complete, partial,
  unavailable, selected-zero, and all-zero states while retaining exact response strings for text.
- [ ] 4.2 Add the responsive estimated-cost donut card after the overview counters, with an
  all-phase or selected-phase center summary, selected-slice emphasis, known-partial labeling,
  exact tooltips, and no fabricated arcs for zero or unavailable values.
- [ ] 4.3 Add the ordered accessible phase list and explanatory current-assignment/range copy so
  phase amounts, shares, completeness, and selected state remain available without pointer or color
  perception.
- [ ] 4.4 Wire the card to the existing timeline response and range/phase state so navigation,
  cached refresh retention, retry, empty success, and cost-generation notices stay synchronized
  without a second query or cache tag.
- [ ] 4.5 Add presentation and overview feature tests covering All and Apply selections, 12h/24h
  changes, every phase and Unassigned, selected zero, all zero, partial and unavailable cost,
  accessible non-pointer content, background-refresh failure, and exact displayed amounts.
- [ ] 4.6 Extend the intercepted browser flow to verify selected-phase visual emphasis and all-phase
  comparison context at the supported desktop viewport.

## 5. Verification

- [ ] 5.1 Run focused backend repository, query-service, HTTP, and generated-contract tests plus
  focused frontend presentation, generated-client, overview, and browser tests.
- [ ] 5.2 Run root generated-file verification, formatting, linting, type checks, the full test
  suite, production builds, and smoke verification, resolving regressions without adding token
  comparison, phase history, additional API requests, or persisted aggregates.
