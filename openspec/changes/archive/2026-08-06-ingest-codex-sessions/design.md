## Context

See `proposal.md` for motivation and `specs/codex-session-ingestion/spec.md` for observable behavior. This change begins after `establish-project-foundation` supplies validated configuration, an Express/tsoa API boundary, a backend-owned DuckDB instance, ordered SQL migrations, generated OpenAPI clients, mirrored test trees, and graceful process lifecycle hooks.

Codex Desktop session sources are local, append-oriented JSONL data whose record shapes can evolve. File-system notifications may repeat, arrive while a file is still being written, or be unavailable until a mount appears. Session records may contain sensitive prompts, responses, reasoning, and tool data that the product does not need. DuckDB must remain owned by one backend process.

## Goals / Non-Goals

**Goals:**

- Isolate Codex source-format knowledge behind a versioned parser adapter.
- Backfill and incrementally follow multiple local session roots without duplicate facts.
- Make the persisted checkpoint and its derived session update one atomic unit.
- Persist compact session-level metadata, developer-turn totals, and token totals instead of transcripts or a generic event warehouse.
- Recover deterministically from interrupted writes, partial records, rewrites, parser upgrades, and repeated watcher events.
- Provide an API and operational status suitable for later attribution, accounting, and dashboard changes.

**Non-Goals:**

- Preserve a replayable copy of sensitive source records in DuckDB.
- Interpret titles as Linear identifiers or workflow phases.
- Resolve model pricing or calculate cost.
- Provide a plug-in abstraction for non-Codex harnesses.
- Optimize distributed or multi-process ingestion.

## Decisions

### 1. Add one ingestion coordinator to the backend lifecycle

A single ingestion coordinator will own root discovery, backfill scheduling, watcher events, explicit rescans, and the queue of source imports. Startup creates it only after configuration, migrations, and repositories are ready. Shutdown first stops source discovery and rescan acceptance, then drains or rolls back the active source transaction before DuckDB closes.

Work is serialized per source path, and database mutations pass through the backend's existing repository boundary. Repeated events for a queued path are coalesced to its newest observed state. Different files may be parsed outside a transaction, but their writes are committed through the coordinator so no second writable DuckDB owner is introduced.

**Alternatives considered:**

- **Let every watcher callback import immediately:** Rejected because duplicate notifications and overlapping backfill can race checkpoints and double-apply deltas.
- **Run a separate ingestion worker process:** Rejected because it would violate the single-writer DuckDB invariant and complicate local deployment.
- **Use a durable external job queue:** Rejected because checkpoints already provide the required recovery and a broker is disproportionate for a local application.

### 2. Use a Codex-specific source and parser adapter

The session module will separate file mechanics from source-format interpretation:

```text
root discovery / watcher
          |
          v
source reader (bytes, offsets, file identity)
          |
          v
versioned Codex record parser
          |
          v
normalized session mutation
          |
          v
repositories + checkpoint transaction
```

The parser consumes complete JSON values and emits only permitted normalized mutations: stable session identity, title and timestamps, developer-turn increments, authoritative token snapshots or token deltas, usage-observed state, and sanitized diagnostics. The parser version is stored with each checkpoint. Increasing it forces a rebuild so newly recognized records can be reconsidered from the original source.

**Alternatives considered:**

- **Parse records directly inside watcher callbacks:** Rejected because format evolution, historical import, and fixture testing would become coupled to file events.
- **Create a generic multi-harness adapter framework:** Rejected because Codex-only support is a product constraint and generic abstractions would reproduce the upstream project's maintenance burden.
- **Persist raw JSON and normalize later:** Rejected because it stores sensitive content unnecessarily and makes privacy depend on every later query.

### 3. Use source-provided session identifiers as the canonical key

`codex_sessions.session_id` will use the stable identifier present in the supported Codex source envelope. Source root and canonical source path are mutable provenance, not identity. A unique session key ensures relocation or recursive rediscovery updates the existing row. A source that cannot yield a stable identifier is marked failed and cannot overwrite another session.

The parser updates the current title as ordinary metadata. It does not parse the title into ticket or phase fields in this change. Later attribution reads the stored current title.

**Alternatives considered:**

- **Use absolute file path as session identity:** Rejected because moving a source, changing the configured root, or reorganizing dated directories would duplicate the session.
- **Hash the whole file:** Rejected because the hash changes whenever an append or title update occurs.
- **Generate a new observer UUID:** Rejected because it would make imports from the same Codex session difficult to reconcile deterministically.

### 4. Persist compact derived state rather than every normalized event

The product tables introduced by this change are:

- `codex_sessions`: stable ID, source provenance, current title, lifecycle timestamps, developer-turn total, parser/import state, created and updated timestamps.
- `codex_session_usage`: one row per session with input, cached-input, output, computed total tokens, usage-observed flag, and updated timestamp.
- `codex_import_checkpoints`: source root/path, source identity, last committed complete-record byte offset, observed size and modification time, parser version, last status, diagnostic counters, and timestamps.
- `codex_import_runs`: run identity, trigger, state, start/end times, file/session counters, and sanitized summary diagnostics.

All token counters use a non-negative 64-bit integer representation in DuckDB and map to JSON-safe API values through repositories. SQL migrations are the schema source of truth; passive database models describe row shapes.

The model/pricing catalog remains JSON configuration owned by the later accounting change. This schema does not introduce model catalog tables or store transcript content.

**Alternatives considered:**

- **Store every Codex record as an event row:** Rejected because issue-level accounting needs compact facts, while event storage increases privacy exposure, volume, and deduplication complexity.
- **Store only a single JSON session blob:** Rejected because typed aggregation, migrations, and explicit privacy review become harder.
- **Calculate values on every API request from source files:** Rejected because APIs would be slow, unavailable when a mount disappears, and unable to provide stable checkpoints.

### 5. Commit one complete source range and its checkpoint atomically

For each source, the reader starts at the last committed byte offset and reads a bounded chunk. It splits only on newline boundaries. A trailing fragment is not sent to the JSON parser and the checkpoint remains before it. Complete records are normalized into a session mutation, then one transaction:

1. Upserts session metadata.
2. Applies developer-turn and token mutations.
3. Updates diagnostic counters and import-run progress.
4. Advances the source checkpoint through the last processed complete record.

If the transaction fails, none of those changes become visible. Restart replays the same source range. Incremental turn deltas apply only once because checkpoint advancement and the delta share a transaction. Cumulative token records replace the applicable authoritative totals rather than being summed; delta-style usage records are added once.

**Alternatives considered:**

- **Advance the checkpoint before writing derived state:** Rejected because a crash could permanently skip usage.
- **Commit after every record:** Rejected because it adds excessive transaction overhead and exposes half-updated session snapshots.
- **Store an incomplete trailing line in the database:** Rejected because the source already retains it and the last complete offset is sufficient recovery state.

### 6. Rebuild atomically after truncation, replacement, or parser upgrade

Each checkpoint records enough source identity and observed size to detect an incompatible change. If the file is shorter than the committed offset, the source identity changes, or the parser version increases, the importer streams the source from byte zero into a replacement session snapshot. It swaps the affected session facts and resets the checkpoint in one transaction only after the rebuild succeeds.

The previously committed session remains queryable during a failed rebuild and is marked with a stale/error import state. This favors availability and auditability over clearing known data on a transient source failure.

**Alternatives considered:**

- **Delete existing facts before rebuilding:** Rejected because a malformed replacement would destroy the last valid observation.
- **Ignore truncation and continue from the old offset:** Rejected because later records would be skipped or parsed from the wrong boundary.
- **Never rescan after parser changes:** Rejected because unknown records could never become supported without deleting the database.

### 7. Treat missing roots and record errors as ingestion health, not process health

Foundation health continues to represent process and persistence initialization. Ingestion has its own status model. A missing mount, unreadable root, malformed complete record, or unknown record type is surfaced through `/api/imports/status` and structured logs without making `/api/health` falsely report that DuckDB failed.

A syntactically complete malformed record is skipped with a sanitized diagnostic because its newline preserves the next boundary. An incomplete trailing record is deferred without a permanent warning. A source without a stable session identity fails as a whole because safe upsert is impossible.

**Alternatives considered:**

- **Fail backend startup when any root is missing:** Rejected because Docker mounts and newly created Codex installations can appear later, and other roots remain useful.
- **Silently ignore all unknown or malformed records:** Rejected because format drift would make totals incomplete without explanation.
- **Log raw failed records:** Rejected because records can contain private code and conversation content.

### 8. Expose read and control operations through authored controllers

Authored tsoa controllers will add:

- `GET /api/imports/status`
- `POST /api/imports/rescan`
- `GET /api/sessions`
- `GET /api/sessions/{sessionId}`

The list operation uses deterministic ordering and bounded pagination. Session responses contain identity, current title, timestamps, token categories, total tokens, developer turns, usage-observed state, and sanitized import state only. The rescan operation talks to the coordinator and returns the active or queued run identity; it never starts a competing writer.

Generated routes, OpenAPI, and frontend RTK Query output remain in their foundation-defined generated locations. No frontend screen is added by this change.

**Alternatives considered:**

- **Expose only internal repository methods:** Rejected because import behavior would not be operationally inspectable and later UI work would need to invent the contract.
- **Expose session source contents for debugging:** Rejected by the privacy requirement.
- **Use a command-line-only rescan:** Rejected because the web application and future automation need the same backend-owned operation.

### 9. Test format behavior with anonymized immutable fixtures

Fixtures will cover each supported Codex envelope/record variant used by the parser, without real prompts, code, paths, credentials, or tool payloads. Fixture builders may create append, truncation, replacement, partial-line, and malformed-record cases in temporary directories. Tests mirror the production source paths under `backend/__tests__`.

The verification layers are:

- Parser unit tests for record classification, developer-turn semantics, token normalization, and sanitization.
- Repository and migration integration tests against temporary DuckDB files.
- Importer tests for backfill, incremental offsets, atomic rollback, rebuild, and idempotency.
- Watcher/coordinator tests for debounce, unavailable roots, late root creation, and shutdown.
- Supertest contract tests for status, rescan, pagination, detail, and error responses.
- Generation-drift, type-check, lint, and build checks inherited from the foundation.

**Alternatives considered:**

- **Use a developer's live `~/.codex` directory in tests:** Rejected because tests would be non-deterministic and could expose private content.
- **Mock repositories in every importer test:** Rejected because checkpoint atomicity must be proven against DuckDB.

## Risks / Trade-offs

- **[Codex changes its undocumented local record format]** → Keep parsing versioned and fixture-driven, surface unknown-record counts, and force source rebuilds when parser support is added.
- **[A session file grows very large]** → Stream bounded ranges, avoid whole-file buffering during normal appends, and use a streaming rebuild path.
- **[File-system notifications are delayed or lost]** → Run recursive discovery during startup and explicit rescans; treat notifications as acceleration rather than the only source of truth.
- **[A root disappears after successful import]** → Preserve the last committed session facts, mark the root unavailable, and resume when it returns.
- **[Cumulative and delta token records are misclassified]** → Encode supported variants explicitly in fixtures and keep token semantics inside the versioned parser rather than generic importer code.
- **[Session title metadata is not updated in the same record stream on every Codex version]** → Keep title extraction inside the Codex source adapter so supported companion metadata can be incorporated without changing repository or API contracts.
- **[Compact totals limit future forensic analysis]** → Preserve source provenance and parser versions so later changes can re-import from local sources; add event storage only through a separate privacy-reviewed proposal.
- **[Bun test and native DuckDB bindings diverge across platforms]** → Extend the foundation compatibility gate with the new migrations and importer repository tests on each supported CI architecture.

## Migration Plan

1. Extend validated configuration with session roots and ingestion timing limits while keeping missing roots non-fatal.
2. Add migrations for sessions, usage totals, checkpoints, and import runs.
3. Add passive database models and repository transactions with temporary-DuckDB tests.
4. Add anonymized Codex fixtures and the versioned parser adapter.
5. Add the incremental source reader, rebuild behavior, ingestion coordinator, and watcher lifecycle.
6. Add session/import controllers, regenerate routes, OpenAPI, and the frontend RTK Query client.
7. Run an explicit historical backfill against fixture roots, then a privacy review confirming no transcript content is persisted or returned.
8. Run all inherited foundation checks plus ingestion-specific tests and builds.

Rollback stops the watcher/coordinator, reverts application code and generated contracts, and restores a database backup taken before the product migration. The migration files remain immutable once applied; forward fixes are used for databases that must preserve imported data.
