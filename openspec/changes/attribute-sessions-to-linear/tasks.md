## 1. Configuration and Persistence Foundations

- [x] 1.1 Add the official Linear SDK dependency and validated optional `LINEAR_API_KEY` configuration, with tests proving the backend remains healthy and makes no Linear calls when the key is absent.
- [x] 1.2 Add a FIFO exclusive-write operation to `AppDatabase`, route existing ingestion transactions through it, and add a concurrency test proving transactional writers do not interleave.
- [x] 1.3 Add migration `003_linear-session-attribution.sql` for the minimal `linear_issues`, `linear_session_attributions`, and `linear_sync_runs` tables, including foreign keys, status constraints, and lookup indexes.
- [x] 1.4 Add migration integration tests covering a fresh database and an upgrade from the existing ingestion schema.
- [x] 1.5 Add passive database row models and repositories for issue cache, current session attribution, and sync runs, with parameterized-query mapping tests against a temporary DuckDB file.

## 2. Title Parsing and Attribution State

- [x] 2.1 Implement the pure session-title parser for the leading `<team-key>-<positive-integer>[: <phase>]` grammar, identifier normalization, and unlinked results.
- [x] 2.2 Add table-driven parser tests for identifier-only titles, optional and empty phases, casing and whitespace, invalid numbers, non-leading identifiers, and unexpected suffix text.
- [x] 2.3 Implement title fingerprinting and current-attribution state transitions for new, renamed, phase-only, unconfigured, linked, not-found, and retryable-error sessions.
- [x] 2.4 Add state-transition tests covering title changes without modifying ingestion-owned session or usage records.

## 3. Read-only Linear Boundary

- [x] 3.1 Define the narrow `LinearIssueReader` interface, minimal issue-summary types, and closed sanitized error categories used by the attribution module.
- [x] 3.2 Implement the official Linear SDK adapter for exact issue lookup, immediate privacy-safe response mapping, returned-identifier verification, and read-only operation.
- [x] 3.3 Add adapter tests for exact matches, absent or inaccessible issues, mismatched identifiers, authentication rejection, rate limits, timeouts or network failures, and upstream server errors without leaking SDK payloads or credentials.

## 4. Attribution Reconciliation

- [x] 4.1 Implement the `AttributionCoordinator` lifecycle and coalescing work queue, including durable startup, ingestion-event, and manual sync-run records and rejection of new work during shutdown.
- [x] 4.2 Implement durable reconciliation that loads current session titles, creates missing attribution rows, reparses changed fingerprints, and keeps valid ingestion data available when Linear is unconfigured.
- [x] 4.3 Implement candidate grouping, in-flight lookup deduplication, bounded remote concurrency, and cache reuse or refresh based on the configured cache TTL.
- [x] 4.4 Persist lookup results in short exclusive-write transactions that recheck title fingerprints and atomically update issue cache, eligible session attributions, and sync-run counters.
- [x] 4.5 Implement outcome handling so confirmed absence becomes `not_found`, retryable failure remains retryable, authentication failure stops the run, and failed refreshes retain previously committed links.
- [x] 4.6 Add coordinator tests for startup backfill, manual-run coalescing, duplicate candidates, title changes during an in-flight lookup, later recovery from `not_found`, cache refresh, partial failure, and graceful shutdown.
- [x] 4.7 Wire committed ingestion session IDs to the coordinator as an optimization, then wire startup reconciliation and attribution shutdown into the backend lifecycle without delaying HTTP readiness for the full remote sweep.

## 5. Authored API Contract

- [x] 5.1 Add authored attribution, minimal Linear issue, integration-status, and synchronization response models without exposing credentials, raw SDK models, transcript content, or unnecessary Linear fields.
- [x] 5.2 Extend the session query service and session list/detail responses with current attribution status, candidate, phase, issue summary, timestamps, synchronization state, and sanitized failure category.
- [x] 5.3 Add the authored `LinearController` with `GET /api/linear/status` and `POST /api/linear/sync`, including the documented unconfigured error and active-run coalescing response.
- [x] 5.4 Compose narrow attribution dependencies into the handwritten API router and add Supertest coverage for session attribution, status counts, sync acceptance or coalescing, and unconfigured behavior.

## 6. Generated Contract Artifacts

- [x] 6.1 Regenerate tsoa route registration and the OpenAPI document from the authored controllers and models; verify generated files contain no handwritten behavior.
- [x] 6.2 Regenerate the frontend RTK Query client from OpenAPI as a separate generated-code change and verify the frontend typecheck succeeds without adding attribution screens.
- [x] 6.3 Run the repository's generated-artifact freshness check and confirm regeneration produces no unexpected diff.

## 7. Verification and Documentation

- [x] 7.1 Add an end-to-end backend fixture test that imports historical and renamed Codex sessions, resolves mocked Linear issues, restarts the backend, and verifies durable attribution and sync status.
- [x] 7.2 Update backend configuration and development documentation for the optional Linear key, title convention, cache behavior, manual synchronization, privacy boundary, and read-only guarantee.
- [x] 7.3 Run backend and frontend tests, typechecks, linting, formatting checks, production builds, and the DuckDB native-client compatibility test; fix any regressions introduced by this change.

## 8. Sticky Link and Explicit Relink Correction

- [x] 8.1 Separate the current parsed title candidate from the authoritative stored Linear issue in attribution state and repository mappings, preserving an established link when a linked session is renamed or loses a valid title candidate.
- [x] 8.2 Update ingestion-event and reconciliation transitions so only sessions without an established link are eligible for automatic initial resolution; refresh linked issue metadata by stored Linear identity rather than a differing title candidate.
- [x] 8.3 Implement a relink service that resolves the session's current title candidate and atomically replaces the stored issue only after exact success, while preserving the previous link for invalid, stale, not-found, authentication, mismatch, and transient-failure outcomes.
- [x] 8.4 Add `POST /api/sessions/{sessionId}/relink` with authored request/response and error models, dependency composition, and Supertest coverage for successful relink, unlinked-session linking, missing candidates, stale titles, and preserved links on failure.
- [x] 8.5 Add repository and coordinator tests proving `ENG-215` remains linked after renames to `ENG-216` or an unlinked title, synchronization cannot silently reassign it, phase-only changes preserve it, and explicit successful relink moves it to `ENG-216`.
- [x] 8.6 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client from the revised authored contract, then run generated-artifact freshness checks.
- [x] 8.7 Update attribution documentation and run backend and frontend tests, typechecks, linting, formatting checks, and production builds for the corrected behavior.
