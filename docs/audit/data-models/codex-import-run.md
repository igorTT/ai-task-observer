# CodexImportRun

Table: `codex_import_runs`

## Purpose

Records operational history for startup scans, watcher work, manual rescans, and rediscovery runs.
It does not own imported session facts.

## Fields

| Field               | Current role                                   | Review focus                     |
| ------------------- | ---------------------------------------------- | -------------------------------- |
| `run_id`            | Primary key generated for a coordinated run    | Retention and external identity  |
| `trigger`           | `startup`, `watch`, `rescan`, or `rediscovery` | Whether all values remain useful |
| `state`             | Queued/running/completed/failed lifecycle      | Crash recovery semantics         |
| `started_at`        | First transition to running                    | Operational value                |
| `completed_at`      | Terminal transition time                       | Operational value                |
| `roots_discovered`  | Additive root counter                          | Whether displayed or actionable  |
| `files_discovered`  | Additive discovered-file counter               | Whether displayed or actionable  |
| `files_imported`    | Additive imported-file counter                 | Counter accuracy                 |
| `sessions_imported` | Additive touched-session counter               | Name and duplicate semantics     |
| `warning_count`     | Sanitized warning count                        | Diagnostic value                 |
| `error_count`       | Failed source count                            | Diagnostic value                 |
| `summary`           | Optional sanitized terminal summary            | Current readers and size         |
| `created_at`        | Local insertion time                           | Overlap with lifecycle times     |
| `updated_at`        | Last state or counter update                   | Current readers                  |

## Current Lifecycle and Readers

The coordinator creates a row, moves it through its lifecycle, and increments counters while
sources are processed. The ingestion status API reads the current run and only the latest terminal
run. Older rows have no current application reader.

## Open Questions

- How much run history should be retained?
- Are per-run counters used for decisions, or only temporary diagnostics?
- Should interrupted `queued` or `running` rows be reconciled after restart?
- Can `created_at`, `started_at`, and `updated_at` be reduced without losing accepted behavior?

No field decisions have been accepted yet.
