## 1. Configuration and Index Reader

- [x] 1.1 Add an optional `CODEX_SESSION_INDEX_PATH` setting with a resolved default of
  `~/.codex/session_index.jsonl`, validation, environment documentation, and coverage for default,
  custom, and invalid paths.
- [x] 1.2 Implement a read-only session-index snapshot reader that consumes complete JSONL lines,
  validates only `id`, `thread_name`, and `updated_at`, and returns sanitized diagnostics for
  malformed or incomplete records.
- [x] 1.3 Implement deterministic duplicate resolution by newest valid `updated_at`, then later
  physical record order, including explicit handling for empty names and invalid timestamps.
- [x] 1.4 Add focused reader fixtures and tests for valid records, duplicate IDs, equal timestamps,
  malformed JSON, invalid fields, partial trailing lines, empty names, and privacy-safe diagnostics.

## 2. Title Reconciliation and Lifecycle Integration

- [x] 2.1 Add a title-only repository operation that updates existing sessions inside the shared
  DuckDB write gate, returns changed session IDs, preserves usage/attribution data, and never
  creates sessions from index-only IDs.
- [x] 2.2 Integrate one index snapshot reconciliation into startup after rollout discovery and
  into explicit rescans, preserving last-known titles for absent or invalid entries.
- [x] 2.3 Add a debounced watcher for the configured index path with safe handling for missing,
  replaced, partially written, and unreadable files, without overlapping database writers.
- [x] 2.4 Route title-change IDs through the existing session-commit notification path so Linear
  attribution recalculates candidates while committed links and usage facts remain stable.
- [x] 2.5 Ensure watcher shutdown, startup ordering, rescan coalescing, and index-unavailable
  behavior are covered without changing the generated API contract.

## 3. Deployment and Documentation

- [x] 3.1 Update local configuration and README documentation with the index path, read-only
  access requirement, missing-index behavior, and title-source semantics.
- [x] 3.2 Document that title changes are index-driven, that rollout parser version bumps cannot
  recover titles, and that the active `link-current-codex-session` workflow depends on this
  capability.

## 4. Regression and End-to-End Verification

- [x] 4.1 Add ingestion integration coverage proving startup backfill populates titles for existing
  sessions without rollout title records and preserves unmatched sessions.
- [x] 4.2 Add rescan and watcher coverage proving index-only renames propagate without rewriting
  rollout files, while missing/malformed entries preserve last-known titles.
- [x] 4.3 Add attribution and usage regression coverage proving title-only updates notify the
  existing reconciliation path without moving committed usage or losing attribution state.
- [x] 4.4 Add API-level coverage proving session list/detail responses expose reconciled
  `currentTitle` values and remain privacy-safe.
- [x] 4.5 Run OpenSpec validation, focused backend tests, formatting, linting, type checking,
  frontend/backend builds, and the repository verification command; confirm no generated API or
  database artifacts changed.
