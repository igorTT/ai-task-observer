# CodexSession

## Purpose

Represents a resumable Codex session. The current table mixes session metadata, source-file
ownership, derived values, and importer state.

## Current Flow

```text
rollout JSONL
  → parser
  → codex_sessions metadata
  → events and observations
  → derived session usage
  → source checkpoint and parser state
```

`codex_sessions` is one part of the persisted session, not the complete record.

## Fields

| Field             | Current role                                 | Decision                              |
| ----------------- | -------------------------------------------- | ------------------------------------- |
| `session_id`      | Stable Codex identity and primary key        | Keep                                  |
| `source_root`     | Discovery root duplicated by source state    | Drop                                  |
| `source_path`     | Current rollout ownership and rebuild lookup | Review; likely move to a source model |
| `current_title`   | UI title and current attribution input       | Keep                                  |
| `started_at`      | Codex session start                          | Keep                                  |
| `ended_at`        | Intended terminal timestamp                  | Drop                                  |
| `developer_turns` | Derived user-message count                   | Keep for now                          |
| `import_state`    | Five-value importer state                    | Replace with two-value readiness      |
| `parser_version`  | Duplicated parser metadata                   | Drop                                  |
| `last_error`      | Session-visible copy of source failure       | Review                                |
| `created_at`      | Local insertion timestamp                    | Review                                |
| `updated_at`      | Local mutation timestamp                     | Review                                |

## Accepted Decisions

- Remove `source_root`.
- Remove `ended_at`; archived sessions can be resumed.
- Remove session-level `parser_version`.
- Replace `import_state` with a ready/stale readiness concept.
- Do not run automatic Linear attribution from MVP ingestion.

## Evidence Snapshot

The reviewed development database contained 230 sessions. All had one shared source root, a start
time, `ready` import state, parser version 4, no end time, and no last error. The table itself is
small; this review concerns ownership and semantics rather than storage size.

## Open Questions

- Final readiness field name and representation
- Whether `source_path` moves to an imported-source model
- Whether `last_error` belongs only to source/checkpoint state
- Whether local creation/update timestamps serve an accepted behavior
- Whether `developer_turns` remains persisted or becomes a query-time aggregate
