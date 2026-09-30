# Design

## Context

See `proposal.md` for motivation and scope. The importer currently loads a checkpoint and a
separate source parse-state row. `CodexIngestionRepository.applySourceChunk()` writes both inside
the source-fact transaction. Their source path, identity, parser version, and update timestamp
overlap. Appends require the saved session ID, model, cumulative baselines, and record cursor.

The parser also carries a normalization epoch into observations, and observation epochs participate
in the pricing revision hash. The existing canonical ingestion and usage-event requirements remain
authoritative. This change uses `skip_specs: true` because product behavior does not change.

## Goals / Non-Goals

**Goals:**

- Make the committed checkpoint sufficient to resume parsing through one persistence lookup.
- Keep cursor and continuation values consistent with committed facts.
- Upgrade existing databases without changing observations or requiring original sources to exist.

**Non-Goals:**

- Establishing root-session ownership or replacing path-based source identity.
- Changing parser normalization, observation IDs, or pricing source revisions.
- Fixing unrelated attribution transaction boundaries, run counters, or import error semantics.

## Decisions

### Keep the existing checkpoint key and add continuation columns

Keep `source_path` as the checkpoint primary key. Move `session_id`, `active_model`,
`normalization_epoch`, the three baseline counters, and `next_record_number` into that row. Keep
existing source root, compatibility identity, observed size, parser version, diagnostics, readiness
status, and checkpoint timestamps. Remove `observed_modified_at_ms`, which source compatibility
does not consult. The source inspection helper may still read stat metadata if useful internally.

Use only the checkpoint's identity and parser version; do not store a second copy inside its
continuation. A source-to-session association uses the current parser-produced session ID. Do not
introduce a new foreign key or alter session/fact source fields in this change.

Alternative: add UUIDs and move observation ownership to checkpoint foreign keys now. Rejected
because it expands this refactor into fact identity, source relocation, and cost coverage changes.

### Retain epoch and remove only the unused parse-state revision

Keep the normalization epoch across appends and restarts so future observations retain the same
provenance and cost hash as before. Remove the parser-maintained `fact_revision`, including its
increment and persistence, since no downstream consumer reads it. Leave session-summary revisions
and pricing revisions intact.

Keep `SourceParseState` or an equivalent internal continuation value for parser input/output; it
is no longer a standalone database model. Preserve the existing interpretation of nullable
baselines, including all-null baseline mapping. Changing that interpretation is a separate parser
correctness issue, not part of consolidation.

Alternative: remove the epoch because reset detection uses baselines. Rejected for this scope:
epoch labels are still persisted on observations and included in cost freshness.

### Read and write the checkpoint as one committed unit

The importer loads the merged checkpoint once and uses its continuation for append processing.
Persist updated continuation and offset with the same events, observations, summaries, and run
progress as today, through the existing exclusive-write gate and explicit source transaction.
Keep parser-produced session identity authoritative for the next append.

A failed chunk preserves the prior offset and continuation. A failed incompatible rebuild retains
the prior facts and continuation while updating the existing sanitized stale/error fields. A
successful rebuild replaces continuation from the start of the source and clears checkpoint error
state. Preserve current handling of failures before source classification and failures for sources
without a committed checkpoint; this change does not invent new checkpoint rows for them.

Relocation cleanup deletes the old checkpoint instead of deleting two state rows. Source-path
replacement replaces the continuation association as part of the current rebuild flow. Preserve
existing relocation detection and fact deletion rules.

Alternative: retain two repositories behind one accessor. Rejected because duplicated metadata and
the requirement to keep two persisted rows consistent would remain.

### Use a forward migration with validated backfill

Add a new migration after the existing baseline and phase migration; do not edit their checksums.
Before dropping the old table, verify checkpoint/state pairs match on source path, identity, and
parser version and that each continuation references an existing session. Every committed
checkpoint must have usable continuation, and every parse-state row must have a checkpoint.

Backfill the new columns from matching parse state, preserving cursor values, counters, model,
epoch, checkpoint diagnostics, and timestamps exactly. Apply appropriate non-null and cursor/epoch
constraints after the backfill, then drop the redundant mtime column and separate parse-state
table. Perform these schema/data changes atomically through the migration framework. Empty
databases must also migrate successfully.

If validation finds inconsistent or missing state, fail migration with a sanitized category and
count; do not guess a baseline, expose paths/content, or silently discard committed facts. An
operator can recover from a backup or deliberately rebuild the local database separately.

Alternative: reset checkpoints and re-import. Rejected because sources may be unavailable and
rebuilds could unnecessarily rewrite observation facts and cost coverage.

## Risks / Trade-offs

- [Epoch removed too early] → Retain it and assert unchanged observation revisions across migration.
- [Migration loses resume state] → Test nonzero offsets, model transitions, resets, null baselines,
  stale checkpoints, and exact continuation equality after backfill.
- [Invalid historical pairs cannot safely be merged] → Validate before destructive DDL and test
  that a migration failure leaves the original schema and data available.
- [Relocation cleanup leaves orphan state] → Exercise existing relocation/replacement cases using
  the single checkpoint owner, including cleanup and subsequent append.
- [A broad audit cleanup slips into implementation] → Retain existing source keys, state labels,
  session metadata, fact tables, callbacks, and API shape for this change.

## Migration Plan

1. Add and test the forward migration and merged checkpoint mapping.
2. Update importer and source-chunk persistence to consume/write the merged state.
3. Remove the old persistence model and repository after all production references are replaced.
4. Verify migration plus append/restart/rebuild parity and unchanged observation/cost revisions.
5. Run focused backend checks and the repository verification command before a pull request.

Upgrade while the backend is stopped; migrations already run before ingestion starts. Back up the
local DuckDB file before upgrading a populated installation. Rollback requires restoring that
backup with the previous application version; there is no automatic down migration, and the old
binary must not run against the consolidated schema.
