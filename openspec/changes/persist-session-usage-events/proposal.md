## Why

The current importer collapses Codex activity directly into session totals, which loses the
model, event time, source counters, and anomaly evidence required for trustworthy cost and
date-level accounting. The application needs an auditable session-event and usage-fact layer
before it can calculate cost or aggregate usage by Linear issue.

## What Changes

- Persist selected structured Codex events for user and assistant messages, model context, and
  token observations, including message content for the internal POC.
- Continue excluding reasoning content, tool arguments, tool results, full opaque source records,
  credentials, and malformed-record payloads from persistence and APIs.
- Preserve source-reported token counters alongside normalized per-observation deltas, source
  identity, UTC event time, active model, completeness, and anomaly state.
- Define input tokens as inclusive of cached input, uncached input as input minus cached input,
  and total tokens as input plus output.
- Preserve the existing developer-turn definition: one explicit user-message event, excluding
  mirrored user response items and all non-user activity.
- Normalize cumulative observations without double counting, retain explicit unknown model/time
  values, and represent invalid or missing categories as unknown rather than zero.
- Rebuild derived event and usage facts atomically when source replacement or parser-version
  changes require a session rebuild.
- **BREAKING**: Replace the existing blanket prohibition on persisted prompt and response text
  with the narrower internal-POC content boundary above.
- Dependency: project foundation and `ingest-codex-sessions` are implemented upstream.
- Non-goals: pricing and dollar estimates, Linear aggregation, phase aggregation, dashboard work,
  MCP, semantic matching, other coding tools, and generic transcript/tool observability.

## Capabilities

### New Capabilities

- `session-usage-events`: Auditable structured session events and normalized token facts with
  model, time, source provenance, completeness, and anomaly semantics.

### Modified Capabilities

- `codex-session-ingestion`: Emit and persist structured events and usage facts, revise token-total
  semantics, preserve idempotence/rebuild behavior, and allow selected message content for the
  internal POC.

## Impact

This change affects the Codex parser and importer, DuckDB migrations, passive database models,
session-event and usage repositories, session query services, fixtures, and ingestion tests. The
backend remains DuckDB's sole writer. Existing session API shapes may gain accounting-completeness
metadata, requiring normal tsoa/OpenAPI/client regeneration; no frontend feature is added.
