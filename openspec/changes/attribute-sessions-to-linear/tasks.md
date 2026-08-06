## 1. Configuration and Persistence Foundations

- [ ] 1.1 Add the official Linear SDK dependency and validated optional `LINEAR_API_KEY` configuration, with tests proving the backend remains healthy and makes no Linear calls when the key is absent.
- [ ] 1.2 Add a FIFO exclusive-write operation to `AppDatabase`, route existing ingestion transactions through it, and add a concurrency test proving transactional writers do not interleave.
- [ ] 1.3 Add migration `003_linear-session-attribution.sql` for the minimal `linear_issues`, `linear_session_attributions`, and `linear_sync_runs` tables, including foreign keys, status constraints, and lookup indexes.
- [ ] 1.4 Add migration integration tests covering a fresh database and an upgrade from the existing ingestion schema.
- [ ] 1.5 Add passive database row models and repositories for issue cache, current session attribution, and sync runs, with parameterized-query mapping tests against a temporary DuckDB file.

## 2. Title Parsing and Attribution State

- [ ] 2.1 Implement the pure session-title parser for the leading `<team-key>-<positive-integer>[: <phase>]` grammar, identifier normalization, and unlinked results.
- [ ] 2.2 Add table-driven parser tests for identifier-only titles, optional and empty phases, casing and whitespace, invalid numbers, non-leading identifiers, and unexpected suffix text.
- [ ] 2.3 Implement title fingerprinting and current-attribution state transitions for new, renamed, phase-only, unconfigured, linked, not-found, and retryable-error sessions.
- [ ] 2.4 Add state-transition tests proving title changes replace or clear the current link without modifying ingestion-owned session or usage records.

## 3. Read-only Linear Boundary

- [ ] 3.1 Define the narrow `LinearIssueReader` interface, minimal issue-summary types, and closed sanitized error categories used by the attribution module.
- [ ] 3.2 Implement the official Linear SDK adapter for exact issue lookup, immediate privacy-safe response mapping, returned-identifier verification, and read-only operation.
- [ ] 3.3 Add adapter tests for exact matches, absent or inaccessible issues, mismatched identifiers, authentication rejection, rate limits, timeouts or network failures, and upstream server errors without leaking SDK payloads or credentials.

## 4. Attribution Reconciliation

- [ ] 4.1 Implement the `AttributionCoordinator` lifecycle and coalescing work queue, including durable startup, ingestion-event, and manual sync-run records and rejection of new work during shutdown.
- [ ] 4.2 Implement durable reconciliation that loads current session titles, creates missing attribution rows, reparses changed fingerprints, and keeps valid ingestion data available when Linear is unconfigured.
- [ ] 4.3 Implement candidate grouping, in-flight lookup deduplication, bounded remote concurrency, and cache reuse or refresh based on the configured cache TTL.
- [ ] 4.4 Persist lookup results in short exclusive-write transactions that recheck title fingerprints and atomically update issue cache, eligible session attributions, and sync-run counters.
- [ ] 4.5 Implement outcome handling so confirmed absence becomes `not_found`, retryable failure remains retryable, authentication failure stops the run, and failed refreshes retain previously committed links.
- [ ] 4.6 Add coordinator tests for startup backfill, manual-run coalescing, duplicate candidates, title changes during an in-flight lookup, later recovery from `not_found`, cache refresh, partial failure, and graceful shutdown.
- [ ] 4.7 Wire committed ingestion session IDs to the coordinator as an optimization, then wire startup reconciliation and attribution shutdown into the backend lifecycle without delaying HTTP readiness for the full remote sweep.

## 5. Authored API Contract

- [ ] 5.1 Add authored attribution, minimal Linear issue, integration-status, and synchronization response models without exposing credentials, raw SDK models, transcript content, or unnecessary Linear fields.
- [ ] 5.2 Extend the session query service and session list/detail responses with current attribution status, candidate, phase, issue summary, timestamps, synchronization state, and sanitized failure category.
- [ ] 5.3 Add the authored `LinearController` with `GET /api/linear/status` and `POST /api/linear/sync`, including the documented unconfigured error and active-run coalescing response.
- [ ] 5.4 Compose narrow attribution dependencies into the handwritten API router and add Supertest coverage for session attribution, status counts, sync acceptance or coalescing, and unconfigured behavior.

## 6. Generated Contract Artifacts

- [ ] 6.1 Regenerate tsoa route registration and the OpenAPI document from the authored controllers and models; verify generated files contain no handwritten behavior.
- [ ] 6.2 Regenerate the frontend RTK Query client from OpenAPI as a separate generated-code change and verify the frontend typecheck succeeds without adding attribution screens.
- [ ] 6.3 Run the repository's generated-artifact freshness check and confirm regeneration produces no unexpected diff.

## 7. Verification and Documentation

- [ ] 7.1 Add an end-to-end backend fixture test that imports historical and renamed Codex sessions, resolves mocked Linear issues, restarts the backend, and verifies durable current attribution and sync status.
- [ ] 7.2 Update backend configuration and development documentation for the optional Linear key, title convention, cache behavior, manual synchronization, privacy boundary, and read-only guarantee.
- [ ] 7.3 Run backend and frontend tests, typechecks, linting, formatting checks, production builds, and the DuckDB native-client compatibility test; fix any regressions introduced by this change.
