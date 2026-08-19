## Why

Imported and priced sessions are not yet queryable as issue-level accounting. The backend needs a
stable aggregation contract that attributes session history to the current committed Linear link
and exposes honest token, turn, session, date, model, and cost summaries.

## What Changes

- Aggregate developer turns, token categories, total tokens, estimated cost, and distinct session
  counts at session and current Linear-issue levels.
- Attribute an entire session's usage history to its current committed link; a title candidate does
  not move usage, while a successful explicit relink moves the full session history.
- Return only issues with at least one currently linked session; cached Linear issues with no linked
  usage are omitted.
- Provide UTC daily buckets plus an explicit `unknown` timestamp bucket. Count turns by user-message
  time and tokens/cost by usage-observation time.
- Define daily session count as distinct sessions active in that bucket and explicitly non-additive
  across days.
- Provide per-session and per-model breakdowns and propagate token, anomaly, and pricing
  completeness instead of presenting partial values as complete.
- Add conceptual issue-usage list/detail HTTP resources through authored tsoa controllers and the
  generated OpenAPI/RTK Query boundary.
- Preserve phase as optional free-form session metadata returned where useful, without aggregating
  by phase in this change.
- Dependencies: `persist-session-usage-events`, `calculate-session-cost-estimates`, and the existing
  `attribute-sessions-to-linear` behavior are upstream.
- Non-goals: attribution history, zero-session workspace issue mirroring, phase aggregation,
  dashboards or other frontend screens, Linear mutation, release management, MCP, semantic
  matching, and support for other coding tools.

## Capabilities

### New Capabilities

- `issue-usage-aggregation`: Current-link session and issue accounting, UTC daily/model breakdowns,
  completeness propagation, and backend query APIs.

### Modified Capabilities

None.

## Impact

This change affects backend aggregation/query services, parameterized DuckDB repositories, passive
response models, authored tsoa controllers, OpenAPI generation, the generated frontend RTK Query
client, and backend API/repository tests. It reads existing Linear attribution and usage/cost facts
without calling or mutating Linear during aggregation. Dashboard implementation remains separate.
