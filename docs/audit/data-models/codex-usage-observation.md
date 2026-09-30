# CodexUsageObservation

Table: `codex_usage_observations`

## Purpose

Stores one normalized token-usage fact from the rollout source. It is the authoritative input for
usage timelines, issue usage, session cost, and cost calculation generations.

## Fields

| Field                         | Current role                           | Review focus                    |
| ----------------------------- | -------------------------------------- | ------------------------------- |
| `observation_id`              | Deterministic path-based primary key   | Replace with internal UUID      |
| `session_id`                  | Owning Codex session                   | Drop; derive through checkpoint |
| `checkpoint_id`               | Not present                            | Add as source ownership FK      |
| `source_path`                 | Rebuild/delete ownership               | Drop; owned by checkpoint       |
| `source_identity`             | Parsed source version                  | Drop; owned by checkpoint       |
| `source_record_number`        | Idempotency and source ordering        | Long-term provenance need       |
| `parser_version`              | Parser version that produced the fact  | Drop; owned by checkpoint       |
| `model`                       | Observed model used for pricing        | Keep exact source semantics     |
| `event_time`                  | Usage occurrence time                  | Timeline and price period       |
| `raw_cumulative_input`        | Source cumulative input counter        | Drop after normalization        |
| `raw_cumulative_cached_input` | Source cumulative cached-input counter | Drop after normalization        |
| `raw_cumulative_output`       | Source cumulative output counter       | Drop after normalization        |
| `raw_last_input`              | Source last-usage input counter        | Drop after normalization        |
| `raw_last_cached_input`       | Source last-usage cached-input counter | Drop after normalization        |
| `raw_last_output`             | Source last-usage output counter       | Drop after normalization        |
| `normalized_input`            | Normalized input tokens                | Keep as `input_tokens`          |
| `normalized_cached_input`     | Normalized cached input tokens         | Keep as `cached_input_tokens`   |
| `normalized_uncached_input`   | Derived uncached input tokens          | Drop; derive when read          |
| `normalized_output`           | Normalized output tokens               | Keep as `output_tokens`         |
| `normalized_total`            | Derived total tokens                   | Drop; derive when read          |
| `normalization_epoch`         | Counter-reset generation               | Drop; no downstream reader      |
| `normalization_method`        | How normalized values were obtained    | Drop; no product reader         |
| `complete`                    | Whole-observation completeness         | Drop; derive from token nulls   |
| `anomaly_codes`               | JSON array of normalization warnings   | Keep as nullable string array   |
| `legacy`                      | Marks legacy aggregate semantics       | Drop; no rows or writer         |
| `created_at`                  | Local insertion time                   | Drop; no reader                 |

## Current Lifecycle and Readers

Rows are inserted idempotently and deleted by source path during rebuild. The entire table is also
hashed to identify the source facts for cost calculation. Timeline, issue, and session-cost queries
read normalized values, model, time, completeness, and anomaly codes.

## Evidence Snapshot

The current Cartodex subagent rollouts contain no token-count records before their fork markers. Their
usage observations therefore represent new child-agent model calls rather than copied historical
usage. The inherited context still appears as newly consumed, mostly cached input on those calls.

## Remaining Architecture Question

Can individual observations be replaced with source-owned hourly, per-model usage aggregates
without losing accepted pricing completeness and cost-coverage behavior? This should be decided
while auditing the downstream cost models.

## Accepted Decisions

- Replace the path-derived `observation_id` with an internal UUID.
- Keep import idempotency separate from row identity through a source-owned unique key.
- Add `checkpoint_id` as the observation's source-ownership relationship.
- Remove `source_path`, `source_identity`, and `session_id` from observations. Source provenance
  and session ownership are derived through the checkpoint.
- Keep `source_record_number` and enforce uniqueness on `(checkpoint_id, source_record_number)`
  while individual observations remain persisted.
- Remove `parser_version`; parser compatibility and rebuild ownership belong to the checkpoint.
- Remove all six `raw_cumulative_*` and `raw_last_*` fields. They are parser inputs, not committed
  product facts. The continuation baseline is stored on the checkpoint, and rebuild reparses the
  rollout source.
- Keep only the three independent normalized counters and rename them to `input_tokens`,
  `cached_input_tokens`, and `output_tokens`.
- Remove `normalized_uncached_input` and `normalized_total`. Null propagation and invalid cached
  input semantics are preserved when deriving them from the three stored counters.
- Remove `normalization_epoch`; it is not consumed by pricing, timelines, rollups, or diagnostics.
- Remove `normalization_method`. Product behavior uses normalized counters and anomaly codes, not
  the parser strategy that produced them.
- Remove `complete`; it is true exactly when the three stored token counters are non-null. Cost
  completeness remains a separate pricing concern.
- Keep anomaly codes because they are surfaced as product warnings and become the retained evidence
  of counter mismatch or reset. Store them as a nullable string array instead of JSON text with
  `[]` on normal rows.
- Remove `legacy` and the `legacy_aggregate` normalization variant. All current observations are
  non-legacy, and no production writer creates legacy observations.
- Remove `created_at`; no current behavior reads the local insertion timestamp.

## Retained Shape

If observations remain individual facts, the retained columns are:

- `observation_id` UUID primary key
- `checkpoint_id` foreign key
- `source_record_number`
- `model`
- `event_time`
- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- nullable `anomaly_codes`

Enforce uniqueness on `(checkpoint_id, source_record_number)`.
