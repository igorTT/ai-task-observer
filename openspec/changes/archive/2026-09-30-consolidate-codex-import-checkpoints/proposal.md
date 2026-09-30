# Proposal

## Why

Incremental ingestion stores its committed file position and parser continuation in two tables
that must advance together. Combining them reduces duplicate source metadata and persistence paths
before further audit changes, while preserving imported facts and reported usage.

## What Changes

- Move the required continuation fields from `codex_source_parse_state` into
  `codex_import_checkpoints`, then remove the separate table and repository.
- Use one persisted checkpoint row for source compatibility, committed byte position, session
  identity, active model, cumulative baselines, normalization epoch, and next record number.
- Remove checkpoint `observed_modified_at_ms` and parser-state `fact_revision`; neither controls
  ingestion compatibility or downstream accounting. Keep existing checkpoint diagnostics and times.
- Migrate existing valid checkpoint/state pairs without reparsing sources or rewriting observations.
- Preserve current append, restart, rebuild, relocation, sanitized status, and failure behavior.

### Non-goals

- Root/subagent grouping, inherited-history filtering, or manual side-chat support.
- New checkpoint UUIDs, mutable source-location identity, or moving fact ownership to checkpoint FKs.
- Removing source fields from sessions or facts, changing readiness states, or redesigning errors.
- Event removal, message-content policy changes, hourly aggregates, or observation simplification.
- Changes to Linear callbacks, cost hashing/generations, import-run counters, APIs, or the frontend.

### Dependencies

No other planned change is required. `add-portable-usage-rollups` remains separate and deferred;
later source-ownership and cost changes must account for this consolidated checkpoint shape.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a persistence refactor under the existing `codex-session-ingestion` and
`session-usage-events` requirements. `.openspec.yaml` declares `skip_specs: true`.

## Impact

Backend SQL migrations, checkpoint row/domain mapping, ingestion repository, importer, and focused
migration/repository/importer tests are affected. The parser's continuation contract remains an
internal value type; it no longer has a separate persistence owner. Existing migration checksums
remain immutable. No generated contract, frontend, runtime dependency, or canonical spec changes
are expected.
