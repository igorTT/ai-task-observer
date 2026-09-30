# CodexSessionUsage

Table: `codex_session_usage`

## Purpose

Caches a per-session usage summary recomputed from `codex_usage_observations`. It is a derived read
model used by session list and detail responses.

## Fields

| Field                     | Current role                              | Review focus                      |
| ------------------------- | ----------------------------------------- | --------------------------------- |
| `session_id`              | Primary key and summary owner             | Relationship enforcement          |
| `input_tokens`            | Summed normalized input                   | Cache value versus query-time sum |
| `cached_input_tokens`     | Summed normalized cached input            | Cache value versus query-time sum |
| `uncached_input_tokens`   | Summed normalized uncached input          | Derivable value                   |
| `output_tokens`           | Summed normalized output                  | Cache value versus query-time sum |
| `total_tokens`            | Summed normalized total                   | Derivable value                   |
| `usage_observed`          | Whether any observation exists            | Derivable value                   |
| `input_complete`          | Input completeness across observations    | Derivable value                   |
| `cached_input_complete`   | Cached-input completeness                 | Derivable value                   |
| `uncached_input_complete` | Uncached-input completeness               | Derivable value                   |
| `output_complete`         | Output completeness                       | Derivable value                   |
| `total_complete`          | Total completeness                        | Derivable value                   |
| `anomaly_codes`           | De-duplicated observation anomalies       | Derivable representation          |
| `fact_revision`           | Incremented on each session recomputation | Invalidation semantics            |
| `updated_at`              | Last summary recomputation                | Current readers                   |

## Current Lifecycle and Readers

A blank row is created with the session. Every touched session is recomputed from all of its usage
observations inside the import transaction. Session list and detail APIs read this table; timeline,
issue-usage, and cost queries instead read observations directly.

## Open Questions

- Does this cache materially improve current session queries at the present data scale?
- If retained, which derived totals and completeness flags are worth storing?
- Is a per-session fact revision needed when cost coverage uses a whole-table observation hash?
- Should `developer_turns`, currently recomputed alongside this table, move here or to a separate
  session summary?

No field decisions have been accepted yet.
