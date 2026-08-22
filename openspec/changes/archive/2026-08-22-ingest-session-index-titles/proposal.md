## Why

Current Codex Desktop rollout JSONL does not contain the task title records that the observer
expects. Codex stores the current task name in `~/.codex/session_index.jsonl`, outside the
configured session roots, so imported sessions have no `current_title`, the dashboard shows
“Untitled session”, and title-derived Linear attribution cannot work reliably.

## What Changes

- Treat the Codex session index as the authoritative source for current session titles.
- Add an explicit, read-only session-index path with a default of `~/.codex/session_index.jsonl`.
- Parse only stable session ID, thread name, and update timestamp; never persist opaque index rows.
- Resolve duplicate index records deterministically by newest valid `updated_at`, with a stable
  physical-order tie-breaker.
- Reconcile index titles into existing sessions at startup and during explicit rescans.
- Watch the index for title renames and route title-only changes through existing attribution
  reconciliation without changing usage facts or session identity.
- Keep unmatched, missing, malformed, and stale index data from failing rollout ingestion.
- Document the read-only index configuration and title-source semantics for local deployments.
- Add realistic index fixtures and regression coverage for backfill, duplicates, renames, orphan
  records, malformed rows, and privacy boundaries.

### Non-goals

- Inferring titles from user messages, assistant messages, rollout content, or filenames.
- Changing the frontend session response shape or generated API client.
- Adding Linear write operations or moving Linear access out of the backend.
- Persisting raw session-index records, transcripts, reasoning, tool data, or credentials.
- Changing title syntax, candidate parsing, or explicit relinking semantics.
- Wiring or documenting the session-index mount for packaged/Docker deployments; the active
  `package-local-deployment` change owns that milestone.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-session-ingestion`: make current-title ingestion use the Codex session index in addition
  to rollout metadata, with deterministic reconciliation, safe missing-data behavior, and live
  rename handling.

## Impact

- Backend configuration, source discovery, ingestion lifecycle, title reconciliation, and the
  session repository.
- Existing Linear attribution consumers, which must observe title-only updates without losing
  committed links or usage facts.
- Local configuration and documentation for the read-only session-index path.
- Backend ingestion, API, integration, and privacy tests; no database schema or generated API
  artifacts are expected to change.
- The active `link-current-codex-session` change becomes dependent on this title-ingestion fix so
  its title-derived workflow can inspect reliable current titles.
