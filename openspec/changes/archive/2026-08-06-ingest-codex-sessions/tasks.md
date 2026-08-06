## 1. Configuration and ingestion boundaries

- [x] 1.1 Extend the validated backend configuration with one-or-more Codex session roots, bounded read-chunk size, watcher debounce, and unavailable-root rediscovery interval, including valid, invalid, default, and multiple-root tests.
- [x] 1.2 Add the Codex-only session module structure for source discovery, byte-range reading, parser adaptation, import coordination, and sanitized diagnostics without introducing a generic harness framework.
- [x] 1.3 Define application-owned session, usage, checkpoint, import-run, parser-mutation, and diagnostic types with explicit non-negative token and developer-turn invariants.
- [x] 1.4 Integrate ingestion creation and shutdown hooks into the backend lifecycle after migration initialization, with a test proving ingestion never starts when foundation initialization fails.

## 2. DuckDB schema and repositories

- [x] 2.1 Add an ordered SQL migration for `codex_sessions`, `codex_session_usage`, `codex_import_checkpoints`, and `codex_import_runs`, including primary keys, uniqueness constraints, non-negative counters, timestamps, and parser/import status fields.
- [x] 2.2 Add passive database models for each ingestion table and centralize DuckDB-to-application conversion for timestamps, 64-bit token values, nullable values, and JSON-safe API output.
- [x] 2.3 Implement the session repository for stable-ID upsert, source-provenance relocation, current-title updates, deterministic paginated listing, detail lookup, and import-state updates.
- [x] 2.4 Implement the session-usage repository for authoritative cumulative-token replacement, once-only delta application, developer-turn updates, usage-observed state, and computed total-token consistency.
- [x] 2.5 Implement checkpoint and import-run repositories for source identity, complete-record byte offsets, parser version, diagnostic counters, run state, and sanitized summaries.
- [x] 2.6 Implement one repository transaction that atomically applies a normalized source chunk, updates run progress, and advances its checkpoint only after all session mutations succeed.
- [x] 2.7 Add mirrored temporary-DuckDB tests for migration idempotency, stable-session uniqueness, source relocation, non-negative counters, JSON-safe conversion, pagination order, transaction rollback, and checkpoint/session atomicity.

## 3. Codex fixtures and parser adapter

- [x] 3.1 Add immutable anonymized fixtures representing every Codex envelope and record variant supported by the proof of concept, replacing prompts, code, paths, credentials, reasoning, and tool payloads with synthetic values.
- [x] 3.2 Implement complete-record envelope validation and versioned record classification that returns supported mutations, unknown-type diagnostics, or malformed-record diagnostics without retaining raw content.
- [x] 3.3 Implement stable session identity, current-title, source metadata, and available lifecycle-timestamp extraction with tests for missing identity, repeated metadata, and title changes.
- [x] 3.4 Implement developer-turn normalization that counts explicit user-authored messages and excludes system, developer, assistant, tool, approval, and control records.
- [x] 3.5 Implement token normalization for supported input, cached-input, output, cumulative-snapshot, and delta record variants without double-counting repeated cumulative values.
- [x] 3.6 Add parser tests for valid sessions without usage, repeated imports, unknown records, malformed complete records, unsupported envelopes, sanitized diagnostics, and the absence of transcript content in emitted mutations.
- [x] 3.7 Add parser-version behavior that marks older checkpoints for rebuild and test that newly supported fixture records are incorporated only after the version-triggered rebuild.

## 4. Discovery, byte-range reading, and importing

- [x] 4.1 Implement recursive discovery across available configured roots with supported-file filtering, canonical provenance, deterministic ordering, and independent unavailable-root status.
- [x] 4.2 Implement source identity and compatibility checks that distinguish an ordinary append from truncation, replacement, relocation, and parser-version invalidation.
- [x] 4.3 Implement bounded byte-range reading from a committed offset, returning complete newline-delimited records plus the last complete byte position while deferring any trailing fragment.
- [x] 4.4 Implement historical source import that streams supported files, builds normalized session state, and writes the first checkpoint without buffering an entire large file.
- [x] 4.5 Implement incremental append import that parses only bytes after the committed checkpoint and applies complete-record mutations through the atomic repository transaction.
- [x] 4.6 Implement atomic full rebuild for truncation, replacement, and parser upgrades, preserving the previously committed session snapshot and marking it stale when rebuilding fails.
- [x] 4.7 Add importer tests for empty roots, nested discovery, new sessions, unchanged re-import, appended records, duplicate notifications, partial trailing records, process-interruption replay, truncation, replacement, relocation, title change, and failed rebuild preservation.

## 5. Coordinator, watcher, and operational status

- [x] 5.1 Implement the single ingestion coordinator with one active operation per source, path-based queueing, duplicate-event coalescing, and backend-owned write serialization.
- [x] 5.2 Implement recursive Chokidar watching for new and changed supported files and connect watcher events to the coordinator without performing persistence inside callbacks.
- [x] 5.3 Implement periodic unavailable-root rediscovery so a root that appears later becomes watched and receives one historical backfill.
- [x] 5.4 Implement startup backfill and explicit rescan scheduling with stable run identities, trigger classification, per-root/file/session counters, and coalescing when a run is active.
- [x] 5.5 Implement sanitized root, checkpoint, warning, error, current-run, and last-completed-run status snapshots for API consumption and structured logging.
- [x] 5.6 Implement graceful shutdown that stops discovery and rescan acceptance, closes watchers, drains or rolls back active work, and completes before DuckDB shutdown.
- [x] 5.7 Add mirrored temporary-directory tests for watcher debounce, a file created during backfill, missing and late-created roots, concurrent rescan requests, independent multiple roots, coordinator error isolation, and graceful shutdown.

## 6. HTTP and generated contract

- [x] 6.1 Add authored tsoa request/response models and an import controller for `GET /api/imports/status` and `POST /api/imports/rescan`, delegating to the coordinator rather than repositories.
- [x] 6.2 Add an authored session controller for deterministic bounded `GET /api/sessions` pagination and `GET /api/sessions/{sessionId}` detail lookup with the documented not-found response.
- [x] 6.3 Wire controllers through the authored router composition and explicit module dependencies without allowing controllers to read files or query DuckDB directly.
- [x] 6.4 Regenerate tsoa routes, the OpenAPI document, and frontend RTK Query client output in their foundation-defined generated locations.
- [x] 6.5 Add Supertest coverage for status, rescan acceptance and coalescing, pagination boundaries and ordering, session detail, not-found behavior, unavailable roots, and sanitized error responses.
- [x] 6.6 Add contract tests proving session and import responses contain permitted metadata and usage facts but never transcript, reasoning, tool-argument, or tool-result fields.

## 7. Verification and documentation

- [x] 7.1 Update the example environment and backend/root READMEs with supported session-root configuration, startup backfill, watcher behavior, explicit rescan, ingestion status, privacy boundaries, and troubleshooting for unavailable roots.
- [x] 7.2 Extend the Bun/DuckDB compatibility gate to apply the ingestion migration and exercise session, usage, checkpoint, and import-run repositories under the supported Node and CI architectures.
- [x] 7.3 Add a fixture-driven privacy verification that inspects persisted DuckDB values, API responses, and captured diagnostics and fails if synthetic transcript or tool payload markers appear.
- [x] 7.4 Run API generation-drift checks, formatting, linting, strict type checking, all Bun tests, independent frontend and backend builds, and a Node.js smoke test that backfills a temporary fixture root and reports the expected sessions.
