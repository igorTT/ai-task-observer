# CodexSourceParseState

Table: `codex_source_parse_state`

## Purpose

Stores the minimum parser continuation state needed to normalize the next appended JSONL records
without replaying the whole file.

## Fields

| Field                   | Current role                               | Review focus                    |
| ----------------------- | ------------------------------------------ | ------------------------------- |
| `source_path`           | Primary key and checkpoint join key        | Ownership with checkpoint       |
| `session_id`            | Session currently produced by the source   | Relationship enforcement        |
| `source_identity`       | Source compatibility identity              | Duplication with checkpoint     |
| `parser_version`        | Version that produced continuation state   | Duplication with checkpoint     |
| `active_model`          | Model applying to subsequent usage records | Required parser continuation    |
| `normalization_epoch`   | Counter-reset generation                   | Drop; not used in normalization |
| `baseline_input`        | Last cumulative input counter              | Required normalization state    |
| `baseline_cached_input` | Last cumulative cached-input counter       | Required normalization state    |
| `baseline_output`       | Last cumulative output counter             | Required normalization state    |
| `next_record_number`    | Stable ordinal for the next source record  | Keep as parser cursor           |
| `fact_revision`         | Parser-maintained source counter           | Drop; no downstream reader      |
| `updated_at`            | Last continuation-state write              | Duplication with checkpoint     |

## Current Lifecycle and Readers

The importer requires this row for append processing. It is replaced after every committed chunk
and deleted before a source rebuild or relocation cleanup. No API reads it directly.

Pricing does not read this table. The parser initializes `active_model` from the continuation
state, replaces it when it encounters a later `turn_context`, and copies the active value into each
new usage observation. Pricing then reads the model stored on that observation. Persisting the
active model prevents an appended chunk that starts with token usage from being labeled `unknown`
when its preceding `turn_context` was committed in an earlier chunk.

## Evidence Snapshot

Codex stores reasoning level in `turn_context.payload.effort`. The observed `gpt-5.6-luna/high`
contexts belong specifically to Cartodex scout subagents; they do not establish the behavior of an
ordinary user-created side chat. Reasoning effort is deferred from this model review.

## Accepted Decisions

- Remove this table and merge its required continuation fields into `codex_import_checkpoints`.
- Do not add reasoning effort to the merged source/checkpoint state during this audit pass.
- Keep `active_model` as parser continuation state when this table is merged into the checkpoint.
  It is not session metadata or a direct pricing input.
- Keep the three baseline counters. They are required to calculate the next delta and detect a
  cumulative-counter reset without replaying the source.
- Keep `next_record_number`. Byte offset does not encode record count, and the value cannot be
  recovered from events or observations because many source records produce neither.
- Drop `normalization_epoch` from the merged continuation state. Reset detection depends on the
  saved baselines, while the epoch is only a label copied to observations.
- Drop `fact_revision`. The parser increments and persists it, but no downstream path reads it.
  The session-usage revision and the pricing source revision are separate mechanisms.
