## 1. Canonical Phase Persistence

- [x] 1.1 Add the shared `SessionPhase` union for `research`, `explore`, `proposal`, `apply`, `verify`, `quick-flow`, and `other`, and replace free-form phase types in authored domain and API models.
- [x] 1.2 Add a DuckDB migration that creates the constrained session phase assignment table, maps exact canonical legacy values unchanged, maps other non-null values to `other`, preserves null as unassigned, and removes the legacy attribution phase column.
- [x] 1.3 Add migration regression tests covering fresh databases, upgrades with canonical/custom/null legacy phases, the database constraint, and migration idempotency/checksum behavior.
- [x] 1.4 Implement the phase-assignment model and repository operations for lookup, idempotent upsert, and clear, with focused temporary-DuckDB tests.

## 2. Separate Phase from Title Attribution

- [x] 2.1 Change the title parser to return only a normalized Linear candidate while retaining identifier-plus-colon-suffix compatibility, and update its table-driven tests.
- [x] 2.2 Remove phase ownership from Linear attribution domain state, persistence, reconciliation, and relinking while preserving all existing issue-link behavior.
- [x] 2.3 Add reconciliation and relink regression tests proving title and Linear operations cannot assign, replace, or clear an explicit phase.

## 3. Phase Mutation API

- [x] 3.1 Implement a phase service that verifies session existence and atomically assigns, replaces, or clears the dedicated phase assignment.
- [x] 3.2 Add the authored `PUT /api/sessions/{sessionId}/phase` request and response contract with canonical-value/null input, updated attribution output, not-found behavior, and documented validation errors.
- [x] 3.3 Add controller and service tests for every canonical phase, `other`, replacement, repeated idempotent requests, clearing, invalid values without mutation, and unknown sessions.

## 4. Phase Read Paths

- [x] 4.1 Update session list and detail queries to obtain phase from the assignment repository and return the canonical union or no phase.
- [x] 4.2 Update issue-usage session queries to left-join dedicated phase assignments and preserve null for unassigned sessions.
- [x] 4.3 Update query-service, repository, API, and end-to-end fixtures and tests to cover assigned `quick-flow`, explicit `other`, and unassigned sessions.

## 5. Generated Contract and Documentation

- [x] 5.1 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client with `npm run generate:api`, keeping generated changes separate from authored API edits.
- [x] 5.2 Verify generated request validation and client types expose only the canonical phase union plus null for mutation.
- [x] 5.3 Update backend documentation to describe explicit phase assignment, canonical values, title-suffix compatibility, and the removal of title-derived phase behavior.

## 6. Verification

- [x] 6.1 Run backend format, lint, type checking, and focused database/module/API test suites for the changed paths.
- [x] 6.2 Run the root generated-file checks, full test suite, and production build, resolving any regressions without adding phase aggregation or frontend editing controls.
