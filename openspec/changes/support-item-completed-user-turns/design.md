## Context

See `proposal.md` for the compatibility failure. The parser currently treats
`event_msg.user_message` as the canonical user-turn source and intentionally ignores user-role
response items because they can mirror submissions or carry injected context. Current rollout
files instead expose the explicit submission as an `event_msg.item_completed` record whose item
type is `UserMessage` and whose permitted text is in the item's content array.

Developer-turn totals are derived from persisted `user_message` events. Source checkpoints store
the parser version, and the existing rebuild path atomically replaces a source's selected events,
usage observations, derived session facts, and checkpoint when that version advances.

## Goals / Non-Goals

**Goals:**

- Normalize both known explicit user-message event shapes to the existing `user_message` fact.
- Correct previously imported sessions through the established atomic parser-version rebuild.
- Preserve source-position idempotency and the current privacy boundary.

**Non-Goals:**

- Treating all user-role response items as turns or attempting content-based deduplication.
- Changing selected-event storage, API contracts, frontend rendering, or token normalization.
- Building a generic or dynamically configurable Codex event-schema registry.

## Decisions

### Recognize the current explicit event at the adapter boundary

The `event_msg` parser branch will accept `item_completed` only when its item is an object with
type `UserMessage` and its content contains permitted text. It will normalize that record to the
same `user_message` event kind and `user` role used by the legacy event.

The existing permitted-content extraction rules will be reused so only supported text is retained.
Malformed or non-user completed items will not produce message facts, and their opaque content will
not enter persistence or diagnostics.

Alternative: count `response_item(role=user)` records as a fallback. Rejected because current
sessions contain user-role response items for mirrored or injected context, so this would inflate
developer-turn totals and weaken the privacy boundary.

Alternative: introduce a second persisted event kind for current records. Rejected because both
source shapes represent the same domain fact, and downstream aggregation already correctly counts
the normalized `user_message` kind.

### Retain both source formats without content-based deduplication

Legacy `event_msg.user_message` support remains unchanged. Each supported explicit record uses its
source position for identity, preserving repeat-import idempotency. The adapter will not compare
message text because identical user submissions can be legitimate separate turns.

Alternative: select one global source format based on file age or application version. Rejected
because source records already identify their own shape, and per-record dispatch is simpler and
safer for historical and mixed fixtures.

### Rebuild existing sources by advancing the parser version

The parser version will advance from 3 to 4. On startup or rescan, existing version-3 checkpoints
will enter the established rebuild path, replacing selected events and recomputing developer-turn
facts in the same backend-owned transaction. Session, issue, and daily queries will then read the
corrected facts without API regeneration or a database migration.

Alternative: update only newly appended records. Rejected because already committed current-format
user messages would remain missing indefinitely.

Alternative: write a one-off DuckDB data migration. Rejected because the source files are the
authority, the parser-version mechanism already exists for semantic reparsing, and direct SQL
cannot safely reconstruct omitted structured events.

## Risks / Trade-offs

- [A future Codex format reuses `item_completed` with a different item schema] -> Require the exact
  `UserMessage` discriminator and permitted text shape; cover malformed and non-user items.
- [A rebuild temporarily increases startup or rescan work] -> Use the existing serialized,
  atomic rebuild path and retain the previous committed facts if a rebuild fails.
- [A source emits both explicit legacy and current canonical events for one submission] -> Current
  observed formats use one canonical shape per rollout. Keep mirrored response items excluded and
  add a fixture if Codex later emits both explicit shapes together.
- [Active files grow during a version rebuild] -> Rely on existing checkpoint and watch
  coalescing so appended complete records are processed after the serialized rebuild.

## Migration Plan

1. Deploy the parser change with parser version 4.
2. Allow startup discovery or an explicit rescan to rebuild version-3 checkpoints.
3. Verify rebuilt session and issue summaries against canonical user-message event counts and
   inspect sanitized import status for failures.
4. If rollback is required, restore the prior parser. Version-4 persisted facts remain valid
   normalized facts; a later parser-version advance can force another authoritative rebuild.
