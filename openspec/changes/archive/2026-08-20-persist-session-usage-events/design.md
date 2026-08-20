## Context

The importer currently emits chunk-level mutations that increment developer turns and replace or
add session-level token totals. `codex_sessions`, `codex_session_usage`, and atomic source
checkpoints provide a reliable ingestion base, but discarded event order, model context, source
times, and raw counter history cannot be reconstructed downstream. See the proposal and delta
specs for the required accounting and internal-POC content boundary.

DuckDB remains owned by the backend process. SQL migrations define storage; passive TypeScript
models and repositories map it. Append processing must remain bounded and source rebuilds must not
expose half-replaced facts.

## Goals / Non-Goals

**Goals:**

- Make selected events and normalized usage observations the auditable source of accounting facts.
- Preserve incremental import, source checkpoint, and rebuild guarantees.
- Keep the existing session summary API usable while distinguishing unknown from zero.
- Allow message content to be removed later without redesigning accounting tables.

**Non-Goals:**

- A generic JSONL warehouse or full Codex replay engine.
- Persisting or serving reasoning and tool payloads.
- Calculating prices, Linear aggregates, or phase aggregates.

## Decisions

### 1. Store selected events separately from accounting observations

Add authored migrations and passive models for three logical record groups:

- `codex_session_events`: session ID, source/checkpoint identity, source record position, event
  kind, message role, nullable UTC timestamp, and nullable permitted message content.
- `codex_usage_observations`: the token event identity; nullable exact source model/time; raw
  cumulative and last-usage counters; nullable normalized category deltas; epoch; normalization
  method; completeness; anomaly codes; and parser version.
- `codex_source_parse_state`: the active model, current cumulative epoch/baseline, and other minimal
  state needed to normalize the next appended record without rereading the prefix.

The existing session usage row becomes a transactionally maintained summary/cache derived from
observations, not the source of truth. This retains cheap session listing while making rebuild and
later audit possible.

Alternative: store every source record as generic JSON. Rejected because it retains prohibited
content, couples queries to unstable source shapes, and turns DuckDB into an opaque event dump.

Alternative: keep only session totals. Rejected because model/time attribution and counter anomaly
analysis cannot be reproduced.

### 2. Use source position as the idempotency boundary

Each selected event and observation receives a unique key derived from source identity plus the
committed record byte range or equivalent stable parser record key. Checkpoint, parse state,
events, observations, and summary updates commit in one backend-owned transaction. Duplicate file
notifications therefore cannot create a second fact even if parser work is repeated.

Message text is not used as a deduplication key because identical user messages can be legitimate
separate turns. The explicit `event_msg.user_message` is canonical; mirrored
`response_item(role=user)` records do not create turns or duplicate message facts.

Alternative: deduplicate by counters, timestamps, or content. Rejected because all can repeat
legitimately.

### 3. Normalize tokens as an ordered state machine

The adapter processes token observations in source order:

1. The first valid cumulative snapshot in an epoch is differenced from a zero baseline.
2. A component-wise monotonic snapshot is differenced from the stored baseline.
3. An identical snapshot produces a zero delta.
4. `last_token_usage` validates, but is not added to, a valid cumulative difference.
5. Any cumulative decrease opens a new epoch. Valid `last_token_usage` supplies that event's delta;
   otherwise the delta is unknown and accounting is incomplete. The new cumulative value becomes
   the next epoch baseline.
6. Standalone supported delta records are applied once by source-record identity.

Raw counters and normalized values use signed-capable DuckDB integer storage so malformed negative
source data can be preserved. Domain mapping exposes only non-negative normalized `bigint` values
or null. Cached greater than input invalidates cached and uncached input, but does not discard an
independently valid input, output, or total.

Alternative: trust and sum every `last_token_usage`. Rejected because cumulative and last values
can describe the same request and would double-count.

Alternative: clamp malformed values. Rejected because a plausible-looking estimate would conceal
bad source data.

### 4. Keep missing model and time explicit

The active exact model comes only from ordered source model context; the event timestamp comes only
from the event envelope. Database columns are nullable and domain/API mapping renders the model as
`unknown` and unknown time as null. Import time, file modification time, and session timestamps are
not accounting substitutes.

This sacrifices apparent completeness in favor of truthful date and pricing behavior.

### 5. Separate removable content from durable accounting facts

Message role/content live only in selected event rows. Developer turns use canonical event
identity, while token observations and their provenance do not depend on message text. A later
content-retention change can null or delete content without changing turn or usage identities.

Reasoning, tool arguments/results, credentials, opaque source JSON, and malformed payloads are
filtered before repository input and are never logged. API changes in this proposal expose
completeness/anomalies, not transcript content.

Alternative: retain the prior no-message-content boundary. Rejected for this internal POC by
explicit product decision, while preserving a narrow schema to make later removal practical.

### 6. Rebuild source-owned facts atomically

A source rebuild stages or transactionally deletes/reinserts only records owned by that source,
recomputes affected session summaries, resets parse state, and advances the checkpoint in the same
commit. Failure rolls back to the previous facts. If multiple sources ever describe one session,
the summary is recomputed across all committed source-owned observations rather than blindly reset.

## Risks / Trade-offs

- [Message content increases local sensitivity] → Keep the database local, never log content,
  exclude reasoning/tools, isolate the content column, and document a future deletion path.
- [Observation rows grow faster than session totals] → Store only selected events, index source and
  session keys, process bounded chunks, and retain a derived session summary for common reads.
- [Source formats change] → Keep versioned adapters and parser state; unknown records remain
  sanitized and parser-version changes trigger atomic rebuilds.
- [Malformed counters make metrics nullable] → Surface category-level completeness and anomalies
  instead of turning unknown values into zeros.
- [Source reset detection can undercount an event without last usage] → Preserve the raw reset,
  mark incomplete, and never infer an unsupported delta.

## Migration Plan

1. Add event, observation, and parse-state tables plus nullable completeness fields without
   removing current session totals.
2. Represent each existing aggregate as a clearly marked legacy observation with unknown model,
   time, and source-detail completeness so data remains queryable during transition.
3. Increment the parser version and rebuild every available source into selected events and
   observations. Replace a legacy observation only after its source rebuild commits.
4. Switch summary reads to observation-derived semantics and regenerate the API artifacts if the
   response contract changes.
5. After verification, keep legacy compatibility only for sessions whose source remains
   unavailable; a later migration may remove obsolete summary-write paths.

Rollback keeps the additive tables in place and restores prior readers/writers. It cannot promise
removal of already persisted message content; an explicit cleanup migration or database deletion is
required if the POC content decision is reversed.
