## 1. Backend Phase Filter Domain and Aggregation

- [x] 1.1 Add the typed current-session-phase reporting filter for every canonical phase plus
  `unassigned`, with omission representing the unfiltered All population and unsupported values
  producing the documented validation error.
- [x] 1.2 Extend the usage timeline repository to constrain known-time observation facts and the
  unknown-time observation count through a direct session phase-assignment join before totals,
  completeness, warnings, and UTC-hour buckets are calculated.
- [x] 1.3 Add repository regression coverage for unfiltered compatibility, canonical phases,
  explicit `other`, unassigned, unlinked sessions, title suffix independence, excluded incomplete
  facts, filtered unknown-time counts, and reassignment or clearing retroactively moving all session
  usage.

## 2. Authored Timeline Service and HTTP Contract

- [x] 2.1 Thread the optional current-session-phase filter through the timeline query service while
  preserving one captured cutoff, global cost-generation provenance, filtered metric completeness,
  and an echoed effective filter in the response.
- [x] 2.2 Extend the authored tsoa controller and response models with the optional `sessionPhase`
  query vocabulary and documented invalid-value behavior without adding any mutation or background
  work to the timeline read.
- [x] 2.3 Add query-service and Supertest coverage for omitted, canonical, unassigned, and invalid
  filters, including exact response values, effective-filter echoing, sanitized errors, UTC range
  behavior, and independence from Linear attribution and title text.

## 3. Generated API Boundary

- [x] 3.1 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client through the root API
  generation command after all authored contract changes are complete.
- [x] 3.2 Extend generated-client tests to prove the typed phase vocabulary, exact `sessionPhase`
  query serialization, null or absent All representation, and preservation of exact decimal-string
  timeline values.

## 4. Overview URL State and Phase Control

- [x] 4.1 Add canonical overview phase URL parsing and update helpers for All, every canonical
  phase, and Unassigned while preserving range and unrelated search parameters and normalizing
  unsupported values to All before requesting data.
- [x] 4.2 Add focused URL-state tests for default omission, canonical selections, Unassigned versus
  `other`, invalid values, parameter preservation, and browser-history restoration.
- [x] 4.3 Add an accessible single-select current-session-phase control to the overview and pass its
  selection with the existing range through the generated timeline query so counters, charts,
  exact bucket rows, completeness, warnings, and unknown-time notice update from one response.
- [x] 4.4 Update overview copy and feature tests to explain current session assignment semantics and
  cover default All, Proposal, Unassigned, invalid URL fallback, loading/error availability, and
  synchronized range-plus-phase navigation.

## 5. Phase Mutation Cache Coherence

- [x] 5.1 Enhance the generated `setPhase` mutation in the authored dashboard API layer to
  invalidate Sessions, IssueUsage, and UsageTimeline without invalidating cost status or triggering
  import or recalculation.
- [x] 5.2 Add API-cache regression coverage proving a successful assignment, replacement, or clear
  refreshes every subscribed phase/range timeline plus session and issue-usage reads.

## 6. Verification

- [x] 6.1 Run focused backend timeline repository, query-service, HTTP, phase, and generated-contract
  tests and focused frontend URL, generated-client, API-cache, and overview feature tests.
- [x] 6.2 Run root generated-file verification, formatting, linting, type checks, the full test
  suite, production builds, and smoke verification, resolving regressions without adding phase
  history, title-derived phase behavior, multi-select, or frontend phase editing.
