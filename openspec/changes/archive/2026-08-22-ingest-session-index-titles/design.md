## Context

See `proposal.md` for the motivation and `specs/codex-session-ingestion/spec.md` for the
behavioral contract. Rollout ingestion already owns stable session identity, usage facts, and
source watchers. `codex_sessions.current_title` already exists, while the server callback from
ingestion to Linear attribution already provides a path for committed session changes.

The additional title source is a small, application-owned JSONL snapshot outside the configured
rollout roots. It must remain read-only, tolerate Codex writing it while the observer reads it, and
never become a second source of session identity or usage facts.

## Goals / Non-Goals

**Goals:**

- Keep rollout ingestion and index-title reconciliation independently recoverable.
- Apply title-only updates through the existing DuckDB write gate and attribution notification
  path.
- Make duplicate selection, malformed input, missing entries, and explicit title clearing
  deterministic.
- Keep the existing session API and database schema compatible.
- Support local development while keeping the backend compatible with a separately mounted index
  in future packaged deployments.

**Non-Goals:**

- Rebuilding or reparsing rollout checkpoints to recover titles.
- Inferring titles from transcript content or task metadata outside the documented index file.
- Adding a new API endpoint or exposing index diagnostics containing raw records.
- Changing Linear candidate syntax, lookup behavior, or relink confirmation semantics.
- Wiring or documenting packaged/Docker mounts, which belongs to the active
  `package-local-deployment` change.

## Decisions

### 1. Use a dedicated snapshot reader for the index

Add a focused reader that loads complete newline-terminated index records, validates an allowlist
of `id`, `thread_name`, and `updated_at`, and returns a map keyed by stable session ID. It will
ignore an incomplete trailing line so a concurrent Codex write cannot invalidate the last usable
snapshot. Parsing errors will produce sanitized counters or categories only.

**Alternative rejected:** extending the rollout parser to inspect arbitrary records or message
content. Current rollout files contain no title fields, and content inference would be fragile and
violate the data boundary.

### 2. Make the index path explicit and independently configurable

Add an optional environment setting for the index path, defaulting to the sibling of the default
Codex sessions root (`~/.codex/session_index.jsonl`). The resolved path is passed to the ingestion
lifecycle separately from rollout roots, allowing Docker and custom local layouts to mount or point
to it explicitly.

**Alternative rejected:** searching parent directories implicitly for an index. That makes custom
mounts ambiguous and can read an unintended user-owned file.

### 3. Resolve duplicates from one deterministic snapshot

For each stable ID, keep the valid record with the greatest parsed `updated_at`. If timestamps are
equal, keep the later physical record in the file. Records with invalid IDs, invalid timestamps,
or non-string names are excluded. A valid empty name represents an explicit clear; a missing index
entry or malformed record produces no update and therefore preserves a previously known title.

**Alternative rejected:** last-record-wins without timestamp validation. The index is append-like,
but physical order alone cannot distinguish an older delayed record from a newer rename.

### 4. Reconcile titles through a title-only repository operation

Add a repository operation that runs inside `AppDatabase.exclusiveWrite`, updates only existing
`codex_sessions.current_title` values, and returns the IDs whose persisted title changed. It will
not call the existing metadata upsert path because that path intentionally detaches and restores
Linear attribution while applying rollout metadata.

The coordinator will reconcile the snapshot after startup discovery and on explicit rescan. A
separate debounced watcher for the index path will trigger the same reconciliation when the file
changes. After the write commits, changed IDs will go through the existing `onSessionsCommitted`
callback, allowing Linear attribution and cost consumers to observe the change without duplicating
their coordination logic.

**Alternative rejected:** treating the index as another rollout source. That would require fake
checkpoints, could duplicate usage work, and would couple title updates to append parsing.

### 5. Keep missing index data non-destructive

The reconciler will update a session only when the current snapshot contains a valid entry for that
ID. It will preserve a previously stored title when an entry is absent or invalid, and will set the
database value to null only for an explicitly valid empty thread name. Unmatched index IDs will
never create sessions.

This separates temporary file truncation, index pruning, and malformed data from an intentional
title clear while retaining valid historical metadata.

### 6. Preserve the single-writer and privacy boundaries

The backend remains the only DuckDB writer. The index is opened read-only and is never copied into
the database as a raw record. The separate path keeps future packaged deployments able to mount the
index read-only; mount wiring and packaging documentation remain owned by `package-local-deployment`.
No generated API artifacts are expected because `currentTitle` is already part of the response
contract.

## Risks / Trade-offs

- **Index unavailable** → continue rollout ingestion and retain absent or last-known titles; log
  only a sanitized source/category diagnostic.
- **Index changes during a read** → parse only complete lines and retry on the next watch event;
  keep the last valid snapshot for malformed trailing data.
- **A title changes while Linear lookup is running** → notify the existing attribution coordinator;
  its title fingerprint and committed-link checks remain authoritative.
- **Index contains many historical records** → parse in one bounded snapshot pass and retain only
  the latest compact record per stable ID; do not persist the full index.
- **A packaged deployment omits the index mount** → retain degraded-but-valid title behavior;
  the `package-local-deployment` change must wire and document the separate read-only mount.

## Migration Plan

1. Deploy the compatible backend and configure the index path or use the default layout.
2. On startup, reconcile titles for already imported sessions without changing usage facts or
   attribution rows.
3. Let the index watcher handle subsequent renames; explicit rescan remains the recovery path.
4. If rolled back, the existing schema and rollout ingestion continue to work; populated titles
   remain stored and no migration rollback is required.
