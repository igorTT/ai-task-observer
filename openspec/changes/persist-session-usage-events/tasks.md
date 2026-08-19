## 1. Persistence and Domain Foundations

- [x] 1.1 Add an ordered SQL migration for selected session events, usage observations, per-source parse state, source-fact revision, nullable completeness, anomaly provenance, and legacy aggregate transition records.
- [x] 1.2 Add passive database models and strict domain types for selected events, raw counters, nullable normalized categories, model/time unknowns, normalization methods, epochs, and anomaly codes.
- [x] 1.3 Implement parameterized repositories that insert source-identified events and observations idempotently, load/update parse state, and recompute session summaries from committed observations.
- [x] 1.4 Add migration and repository tests for keys, nullable categories, raw negative counter preservation, source ownership, and JSON-safe bigint mapping.

## 2. Parser and Usage Normalization

- [x] 2.1 Refactor the versioned Codex adapter to emit ordered selected event and observation facts instead of only chunk-level totals.
- [x] 2.2 Persist explicit user and assistant message roles/content while filtering reasoning, tool arguments/results, credentials, opaque payloads, and malformed-record content before repository input or logging.
- [x] 2.3 Preserve explicit user-message events as canonical developer turns and prove mirrored user response items, approval/control events, and repeat imports do not add turns.
- [x] 2.4 Track exact active model and nullable source timestamp through ordered records, using `unknown`/null without synthesized fallbacks.
- [x] 2.5 Implement the cumulative normalization state machine: monotonic differences, repeated-zero deltas, last-usage validation, mismatch anomalies, reset epochs, valid reset fallback, and incomplete reset handling.
- [x] 2.6 Enforce input-inclusive-cached and total-input-plus-output semantics and propagate negative or cached-greater-than-input categories as null without clamping.
- [x] 2.7 Add anonymized JSONL fixtures covering mirrored messages, identical repeated prompts, two models, missing timestamps, cumulative repeats, cumulative/last mismatch, reset with/without last usage, standalone deltas, negative values, and cached input greater than input.
- [x] 2.8 Add parser unit tests with exact turn counts, raw counters, normalized deltas, model/time assignments, epoch numbers, completeness, and anomaly-code expectations for every fixture.

## 3. Atomic Incremental Import and Rebuild

- [x] 3.1 Extend incremental import transactions to commit selected facts, parse state, derived summaries, fact revision, and byte checkpoint atomically.
- [x] 3.2 Extend source replacement and parser-version rebuilds to replace only source-owned facts, recompute shared session summaries, and preserve the prior committed snapshot on failure.
- [x] 3.3 Migrate existing aggregate rows into explicitly incomplete legacy observations, then replace them only after a successful source rebuild.
- [x] 3.4 Add importer/repository integration tests for duplicate notifications, restart from checkpoint, partial trailing records, source replacement, failed rebuild rollback, and multiple source-owned contributions to one session.

## 4. Query Contract and Documentation

- [x] 4.1 Update session query models/services to return corrected token totals, nullable incomplete categories, `usageObserved`, token completeness, and sanitized anomalies without exposing message transcripts.
- [x] 4.2 Update root/backend documentation and repository privacy guidance to state the internal-POC message-content boundary and continued prohibition on reasoning, tools, credentials, and raw payloads.
- [x] 4.3 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client in the root generation step; do not hand-edit generated files.
- [x] 4.4 Add Supertest contract coverage for valid, absent, incomplete, anomalous, and rebuilt session usage responses.

## 5. Verification

- [x] 5.1 Run focused backend parser, importer, repository, migration, and API tests and resolve regressions in existing ingestion and Linear attribution behavior.
- [x] 5.2 Run formatting, lint, type checking, generated-file verification, workspace tests, and builds for the completed change.
