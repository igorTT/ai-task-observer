## Why

Native filesystem notifications can be missed for actively appended Codex rollout files, leaving
committed checkpoints stale and recent token usage absent until a restart or explicit rescan. The
ingestion service needs a bounded, low-frequency recovery path that preserves prompt event-driven
updates without continuously polling every file.

## What Changes

- Periodically reconcile available Codex session roots on a configurable, low-frequency interval
  and enqueue supported files whose source state may have advanced.
- Keep native filesystem watching as the prompt ingestion path; recovery reconciliation is a
  safety net rather than a high-frequency replacement watcher.
- Reuse incremental checkpoints so unchanged files are inexpensive to inspect and appended records
  are imported exactly once.
- Coalesce recovery work with watcher, startup, and explicit-rescan work so one source is not
  imported concurrently or counted twice.
- Expose sanitized operational evidence when recovery discovers work or fails, without exposing
  source contents or adding a new public API.
- Add production-representative tests for missed native notifications and eventual recovery.
- Non-goals: guaranteeing sub-second ingestion, changing token normalization or timeline bucketing,
  persisting raw Codex records, or replacing explicit rescans.
- Dependency: this change builds on the existing incremental append, atomic checkpoint, and
  ingestion coordinator behavior; it does not depend on another active OpenSpec change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-session-ingestion`: Require low-frequency recovery reconciliation for missed source-file
  notifications while retaining incremental, serialized ingestion semantics.

## Impact

- Backend ingestion coordination, discovery scheduling, configuration, and sanitized logging.
- Backend coordinator/configuration tests and ingestion integration coverage.
- No database migration, generated API contract, frontend change, or new dependency is expected.
