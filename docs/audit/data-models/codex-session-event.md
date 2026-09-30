# CodexSessionEvent

Table: `codex_session_events`

## Purpose

Persists selected user messages, assistant messages, model-context changes, and token-usage events
from rollout JSONL. It intentionally excludes reasoning, tool payloads, credentials, and opaque raw
records.

## Fields

| Field                  | Current role                                   | Review focus                      |
| ---------------------- | ---------------------------------------------- | --------------------------------- |
| `event_id`             | Deterministic primary key                      | Need alongside source uniqueness  |
| `session_id`           | Owning Codex session                           | Relationship enforcement          |
| `source_path`          | Rebuild/delete ownership                       | Duplication across fact tables    |
| `source_identity`      | Identity of the parsed source version          | Current readers                   |
| `source_record_number` | Stable record position                         | Idempotency and ordering          |
| `event_kind`           | User, assistant, model-context, or token event | Which kinds are actually consumed |
| `message_role`         | User or assistant for message events           | Derivable from event kind         |
| `event_time`           | Source event timestamp                         | Timeline and attribution use      |
| `message_content`      | Selected user or assistant text                | Current product need and DB size  |
| `parser_version`       | Parser version that selected the event         | Rebuild ownership                 |
| `created_at`           | Local insertion time                           | Current readers                   |

## Current Readers

- User-message rows are counted to recompute `developer_turns`.
- User-message timestamps feed issue-level daily activity.
- No current API or frontend reader returns `message_content`.
- No current query was found consuming assistant-message, model-context, or token-usage rows after
  ingestion.

## Evidence Snapshot

Each of the three current Cartodex subagent rollouts contains seven inherited assistant messages before
its fork marker and two assistant messages produced after the fork. The importer does not use the
fork marker, so all nine are persisted under a new source path. This creates 21 duplicated
assistant-message rows across the three subagents even though the inherited messages are not new
session activity.

## Open Questions

- Can developer turns and hourly activity use a source-owned hourly aggregate instead of generic
  events?
- Are assistant, model-context, and token-usage event rows redundant with usage observations and
  parser state?
- Should records before a subagent's history boundary be excluded from persisted events?
- Which source provenance fields are necessary after idempotent import?

## Accepted Decisions

- Remove `codex_session_events` rather than trimming it into another generic event table.
- Do not persist user or assistant message content.
- Replace user-message rows with an hourly developer-turn aggregate owned by the rollout source.
- Drop assistant-message rows; no accepted behavior consumes them.
- Keep model context only as parser continuation state in the merged import checkpoint.
- Represent token usage only through the usage model being audited next.
