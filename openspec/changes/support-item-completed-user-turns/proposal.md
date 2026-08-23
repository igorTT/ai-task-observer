## Why

Current Codex Desktop rollout files emit explicit user submissions as
`event_msg.item_completed` records containing a `UserMessage` item, while the importer only
recognizes the legacy `event_msg.user_message` shape. Newly imported sessions therefore report
zero developer turns even when their committed source range contains user-authored messages.

## What Changes

- Recognize the current `item_completed`/`UserMessage` event as a canonical user-message fact.
- Preserve support for legacy `user_message` events and continue excluding mirrored
  `response_item(role=user)` records and non-user activity.
- Advance the parser version so existing checkpoints rebuild and affected session, issue, and date
  summaries receive corrected developer-turn facts.
- Add regression coverage for legacy and current event shapes, excluded mirrors, rebuilds, and
  repeat-import idempotency.
- Non-goals: changing the API or UI contracts, redefining what a developer turn means, adding a
  generic schema registry, or changing token-usage normalization.
- Dependencies: none. This change is independently reviewable and does not depend on the active
  chart, cost-estimate, or deployment changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-usage-events`: Treat both supported legacy and current explicit Codex user-message
  event shapes as canonical developer turns without counting mirrored response items.

## Impact

- Affects the backend Codex session parser, parser-version compatibility rebuilds, selected
  session events, and derived developer-turn aggregates.
- Requires focused parser and importer regression tests plus verification that rebuilt facts
  remain idempotent.
- Does not change generated API artifacts, database schema, frontend behavior, dependencies, or
  the backend's single-writer DuckDB boundary.
