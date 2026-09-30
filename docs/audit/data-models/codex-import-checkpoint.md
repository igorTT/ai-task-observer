# CodexImportCheckpoint

Table: `codex_import_checkpoints`

## Purpose

Tracks how far one rollout source was committed and whether it can be appended or must be rebuilt.
It is the main persisted source/import model.

## Fields

| Field                     | Current role                                    | Review focus                         |
| ------------------------- | ----------------------------------------------- | ------------------------------------ |
| `checkpoint_id`           | Not present                                     | Add an internal stable primary key   |
| `session_id`              | Not present                                     | Add an explicit session relationship |
| `source_path`             | Primary key and source lookup                   | Keep as a unique mutable location    |
| `source_root`             | Configured discovery root                       | Drop                                 |
| `source_identity`         | Device/inode/prefix-hash compatibility identity | Keep for replacement detection       |
| `committed_offset`        | Last complete JSONL byte committed              | Required for incremental append      |
| `observed_size`           | File size at the last commit                    | Keep for compatibility checks        |
| `observed_modified_at_ms` | File mtime at the last commit                   | Drop; no current decision uses it    |
| `parser_version`          | Parser compatibility marker                     | Keep here as the source-level owner  |
| `status`                  | Pending/importing/ready/stale/failed            | Reduce to ready/stale readiness      |
| `unknown_records`         | Cumulative ignored-record count                 | Retention and diagnostic use         |
| `malformed_records`       | Cumulative malformed-record count               | Retention and diagnostic use         |
| `last_error`              | Sanitized source failure                        | Correct owner and clearing rules     |
| `created_at`              | Local insertion time                            | Current readers                      |
| `updated_at`              | Last successful or failed checkpoint update     | Operational value                    |

## Current Lifecycle and Readers

The importer reads this row before every source inspection. A successful source-chunk transaction
upserts it as `ready`; an incompatible rebuild failure changes an existing row to `stale`. The
status API lists all checkpoints but exposes only basename, status, offset, diagnostic counts, and
last error.

## Relationships

The row is keyed by the same `source_path` used by `codex_sessions`,
`codex_source_parse_state`, events, and observations. It overlaps most strongly with parse state.

The current Codex format can create several rollout sources for one root session through
subagents. A subagent has its own thread `id`, while `session_id`, `parent_thread_id`, and
`forked_from_id` point to the root session. The importer currently resolves those source files back
to the root session. No separate rollout or thread row was found for the reviewed user-created side
chats.

## Evidence Snapshot

The current root session has four ready checkpoints: one parent rollout and three Cartodex
subagent rollouts. All four parse-state rows resolve to the same root session ID. The session-level
`source_path` currently points to whichever subagent source was imported most recently, showing
that one path cannot represent the whole session.

The two reviewed user-created side chats have separate runtime IDs in desktop client bindings, and
an active side chat reports equal `CODEX_THREAD_ID` and `CODEX_SESSION_ID`. Neither side chat has a
rollout file, persisted thread/history row, spawn edge, or import checkpoint. They are therefore
not source children in the current local ingestion boundary.

One of the reviewed side chats had already been closed with a warning that it could not be opened
again, yet it still had no durable local source. Treat manual side chats as unsupported by the
current importer. Supporting their usage is deferred beyond the MVP audit.

## Open Questions

- Do diagnostics need lifetime totals, last-run values, or neither?
- Is `updated_at` needed by an accepted operational view?
- Does `created_at` serve any behavior independently of source metadata?
- Do any accepted behaviors need the external Codex thread ID as a separate field?

## Audit Conclusion

- Keep one checkpoint per rollout thread/source.
- Add an internal `checkpoint_id` as the primary key; do not couple checkpoint identity to a Codex
  metadata field without a separate requirement.
- Add `session_id` as a non-unique foreign key to `codex_sessions`: one root session can own its
  main rollout and multiple subagent rollouts.
- Make this model the single owner of `source_path`; keep the path unique but do not use it as row
  identity.
- Remove `source_root`.
- Remove `observed_modified_at_ms`, which has no current reader or compatibility role.
- Keep cursor and compatibility fields: `source_identity`, `committed_offset`, `observed_size`, and
  `parser_version`.
- Replace the five-state status with ready/stale readiness.
- Keep the diagnostic counters and sanitized last error for now.
- Record manual side chats as a known tracking gap; do not expand this model to support them during
  the MVP audit.
