# codex-session-ingestion Specification

## Purpose

Provides reliable, privacy-safe discovery and ingestion of Codex Desktop sessions so downstream capabilities can use stable session, developer-turn, and token facts without reading Codex files directly.

## Requirements

### Requirement: Configured Codex session sources

The system SHALL accept one or more local Codex session roots and SHALL report the availability and readability of each root independently.

#### Scenario: Available session root

- **WHEN** a configured root exists and is readable
- **THEN** the system SHALL mark the root available and include it in discovery, backfill, and watching

#### Scenario: Unavailable session root

- **WHEN** a configured root is missing, unreadable, or not a directory
- **THEN** the backend SHALL remain available, mark that root unavailable with an actionable reason, and continue processing other available roots

#### Scenario: Root becomes available later

- **WHEN** a previously unavailable configured root becomes readable while the backend is running
- **THEN** the system SHALL discover it without requiring a process restart and SHALL schedule its historical backfill

### Requirement: Recursive historical discovery

The system SHALL recursively discover supported Codex session files beneath every available root and SHALL be able to backfill all discovered sessions.

#### Scenario: Historical sessions exist

- **WHEN** ingestion starts or an explicit rescan is requested for a root containing supported session files
- **THEN** the system SHALL discover and import every supported file beneath that root, including files in nested date directories

#### Scenario: No historical sessions exist

- **WHEN** a root is available but contains no supported session files
- **THEN** the backfill SHALL complete successfully with zero imported sessions

#### Scenario: Unsupported file is present

- **WHEN** discovery encounters a file that does not match a supported Codex session source
- **THEN** the system SHALL leave the file unchanged and SHALL not create a session from it

### Requirement: Stable session identity and metadata

The system SHALL identify a Codex session by its source-provided stable session identifier and
SHALL persist its current title and available lifecycle timestamps without deriving a Linear
association. A current title MAY come from supported rollout metadata or the authoritative Codex
session index. The absence or temporary invalidity of an index entry SHALL NOT make an otherwise
valid session unimportable.

#### Scenario: New session identity

- **WHEN** a supported source contains a valid stable session identifier that has not been imported
- **THEN** the system SHALL create exactly one session record for that identifier

#### Scenario: Session is rediscovered at another path

- **WHEN** a previously imported stable session identifier is discovered through an updated or relocated source path
- **THEN** the system SHALL update the existing session's source metadata rather than create a duplicate session

#### Scenario: Session title changes

- **WHEN** a supported rollout source reports a different current title for an existing session
- **THEN** the system SHALL update the persisted title while preserving the session identity and
  accumulated usage facts

#### Scenario: Session title changes in the session index

- **WHEN** a valid session-index entry reports a different non-empty thread name for an existing
  session
- **THEN** the system SHALL update the persisted title while preserving the session identity and
  accumulated usage facts

#### Scenario: Current title is unavailable

- **WHEN** an imported session has no valid rollout title and no valid session-index entry
- **THEN** the system SHALL keep the session importable with an absent current title

#### Scenario: Previously known title has no current index entry

- **WHEN** an existing session has a persisted title but the current session-index snapshot has no
  entry for its stable identifier
- **THEN** the system SHALL preserve the last known title and SHALL NOT fail or delete the session

### Requirement: Session index title source

The system SHALL support a separately configured, read-only Codex session-index file whose default
path is `~/.codex/session_index.jsonl`. Each valid index record SHALL contain a stable session ID,
an optional thread name, and a valid update timestamp; records that do not meet the required shape
SHALL be ignored without exposing their contents.

#### Scenario: Default session index is available

- **WHEN** the backend starts with the default Codex layout and `~/.codex/session_index.jsonl` is
  readable
- **THEN** it SHALL use the index as an additional current-title source without requiring a
  change to the configured rollout session root

#### Scenario: Custom session index path is configured

- **WHEN** a deployment provides an explicit session-index path
- **THEN** the backend SHALL read that path instead of assuming the default location

#### Scenario: Session index is missing or unreadable

- **WHEN** the configured session-index file is missing or unreadable
- **THEN** rollout discovery and ingestion SHALL remain available, and sessions SHALL remain valid
  with absent or previously persisted titles

#### Scenario: Duplicate session-index records exist

- **WHEN** multiple valid index records have the same stable session ID
- **THEN** the system SHALL select the record with the newest valid update timestamp, using later
  physical record order as the deterministic tie-breaker

#### Scenario: Malformed or partially written index records exist

- **WHEN** an index line is malformed, has invalid required fields, or is an incomplete trailing
  line
- **THEN** the system SHALL ignore that line, retain the last valid snapshot, and continue
  processing without logging raw record content

### Requirement: Session-index title reconciliation

The system SHALL reconcile valid session-index titles with persisted sessions during startup and
explicit rescan operations, and SHALL observe index changes while running. A title-only update
SHALL preserve usage facts, session identity, and committed attribution while making the current
candidate available to downstream attribution reconciliation.

#### Scenario: Startup backfill reconciles titles

- **WHEN** the backend starts with imported sessions and a readable session index
- **THEN** it SHALL apply matching valid index titles before serving the resulting session state

#### Scenario: Explicit rescan reconciles unchanged rollout files

- **WHEN** a client requests a rescan after a session-index title changed but its rollout file did
  not change
- **THEN** the system SHALL reconcile the new title without requiring a rollout-file rewrite

#### Scenario: Index title rename is observed

- **WHEN** a watched session-index file changes and a valid entry's thread name changes
- **THEN** the system SHALL process the title update without overlapping database writers and SHALL
  expose the new title through session detail and list responses

#### Scenario: Title-only attribution candidate changes

- **WHEN** a title update changes the parsed Linear candidate for a session
- **THEN** the system SHALL pass the updated title through the existing attribution reconciliation
  path while preserving the committed issue link until the documented explicit relink operation

#### Scenario: Unmatched index record exists

- **WHEN** a valid session-index record has no corresponding imported session
- **THEN** the system SHALL ignore it for persistence and SHALL not create a session without a
  supported rollout identity

### Requirement: Session-index privacy boundary

The system SHALL persist and expose only the stable session ID, permitted thread name, and update
metadata needed for title reconciliation. It SHALL NOT persist or expose raw index records,
transcripts, reasoning, tool data, credentials, or malformed index payloads.

#### Scenario: Valid index metadata is processed

- **WHEN** the backend reads a valid session-index record
- **THEN** it SHALL retain only the fields needed to reconcile the current title and SHALL expose
  the resulting title only through the existing session metadata contract

#### Scenario: Index parsing fails

- **WHEN** an index record cannot be parsed or validated
- **THEN** diagnostics SHALL identify only a sanitized source and failure category without raw
  record content

#### Scenario: Index file is mounted read-only

- **WHEN** the backend runs with the session index mounted read-only
- **THEN** title ingestion SHALL work without attempting to write, lock, or modify the Codex index

### Requirement: Developer-turn normalization

The system SHALL count one developer turn for each explicit user-authored message submitted in a Codex session and SHALL exclude system instructions, developer instructions, assistant responses, tool activity, and non-message control events.

#### Scenario: User-authored messages are imported

- **WHEN** a session contains multiple explicit user-authored messages
- **THEN** the persisted developer-turn total SHALL equal the number of those messages

#### Scenario: Non-user records are imported

- **WHEN** a session contains assistant, system, developer, tool, approval, or other control records
- **THEN** those records SHALL not increase the developer-turn total

#### Scenario: Session is re-imported

- **WHEN** a session containing previously counted developer turns is imported again without new user messages
- **THEN** its developer-turn total SHALL remain unchanged

### Requirement: Token-usage normalization

The system SHALL persist supported source token observations and normalized input, cached-input,
uncached-input, output, and total-token facts without double-counting cumulative values. Input SHALL
include cached input, and total tokens SHALL equal input plus output. Missing or invalid categories
SHALL be represented as unknown and SHALL make the affected aggregate incomplete.

#### Scenario: Supported token usage is present

- **WHEN** a session contains supported token-usage records
- **THEN** the system SHALL persist their raw counters and normalized deltas and SHALL derive session totals from the normalized deltas

#### Scenario: Cumulative token snapshot repeats

- **WHEN** a source repeats a cumulative token snapshot
- **THEN** the repeated observation SHALL contribute a zero delta and SHALL NOT increase session totals

#### Scenario: Token usage is absent

- **WHEN** a valid session has no supported token-usage records
- **THEN** the session SHALL remain importable with unknown token totals and an explicit indication that no usage was observed

#### Scenario: Token category is invalid

- **WHEN** a supported record contains a negative counter or cached input greater than input
- **THEN** the system SHALL preserve the source value for audit, mark affected categories unknown, and report incomplete accounting without silently correcting the value

### Requirement: Privacy-safe persistence

The system SHALL persist only selected structured events, metadata, and normalized usage facts
required by the internal POC. It MAY persist user and assistant message content, but SHALL NOT
persist or expose reasoning content, tool arguments, tool results, credentials, opaque full source
records, or malformed-record payloads. Diagnostic logs and status responses SHALL remain sanitized.

#### Scenario: Permitted message content is parsed

- **WHEN** a supported record contains an explicit user message or assistant response
- **THEN** the system MAY persist that message's role, content, source identity, and event time as a selected structured event

#### Scenario: Content-bearing records are parsed

- **WHEN** a supported record contains reasoning content, tool arguments, tool results, credentials, or an opaque payload
- **THEN** the parser SHALL omit that content from DuckDB, logs, diagnostics, and APIs

#### Scenario: Import failure is logged

- **WHEN** a record cannot be parsed
- **THEN** diagnostic logs and API status SHALL identify the source location and failure category without including raw record content

### Requirement: Incremental append processing

The system SHALL process newly appended complete records without reparsing an unchanged prefix during normal operation.

#### Scenario: Complete records are appended

- **WHEN** one or more newline-terminated records are appended after the last committed checkpoint
- **THEN** the system SHALL process only the appended range, update the session facts, and advance the checkpoint through the last complete record

#### Scenario: Duplicate file-system notifications occur

- **WHEN** multiple change notifications describe the same unchanged file state
- **THEN** the system SHALL perform no duplicate usage or turn updates

#### Scenario: New session file appears

- **WHEN** a supported session file is created beneath an available watched root
- **THEN** the system SHALL import it without requiring an explicit rescan or process restart

### Requirement: Atomic resumable checkpoints

The system SHALL commit session changes and the corresponding source checkpoint atomically so an interrupted import can safely resume.

#### Scenario: Import chunk succeeds

- **WHEN** all complete records in an import chunk are normalized and persisted successfully
- **THEN** the system SHALL commit both the updated session facts and the checkpoint for that chunk

#### Scenario: Import chunk fails before commit

- **WHEN** persistence or normalization fails before an import chunk commits
- **THEN** neither its derived session changes nor its checkpoint advancement SHALL become visible

#### Scenario: Backend restarts after interruption

- **WHEN** the backend restarts after an interrupted import
- **THEN** it SHALL resume from the last committed checkpoint and SHALL not duplicate previously committed turns or tokens

### Requirement: Partial trailing record safety

The system SHALL defer an incomplete trailing JSONL record until the source contains its terminating newline and complete payload.

#### Scenario: File ends mid-record

- **WHEN** a watched file ends with an incomplete JSONL record
- **THEN** the system SHALL leave the checkpoint before that record, SHALL not report it as a permanent malformed record, and SHALL wait for more bytes

#### Scenario: Partial record is completed

- **WHEN** later file content completes the previously partial record
- **THEN** the next import SHALL process that record exactly once

### Requirement: Source rewrite recovery

The system SHALL detect when a previously checkpointed source was truncated, replaced, or requires
a newer parser version and SHALL rebuild the affected session metadata, selected events, usage
observations, derived totals, and developer turns from the current source.

#### Scenario: Source is truncated or replaced

- **WHEN** the current source identity or size is incompatible with its committed checkpoint
- **THEN** the system SHALL perform a full re-import and atomically replace all derived session records owned by that source

#### Scenario: Parser version changes

- **WHEN** the configured parser version is newer than the version recorded in a source checkpoint
- **THEN** the system SHALL rebuild the affected session from the beginning so newly supported records can be incorporated

#### Scenario: Rebuild fails

- **WHEN** a full rebuild cannot complete
- **THEN** the previously committed selected events, usage facts, session totals, and checkpoint SHALL remain available and import status SHALL report the failed rebuild

### Requirement: Unknown and malformed record tolerance

The system SHALL distinguish unknown record types, malformed complete records, and fatal source failures so one unsupported record does not corrupt known session totals or block unrelated sessions.

#### Scenario: Unknown record type is encountered

- **WHEN** a syntactically valid record has an unsupported type
- **THEN** the system SHALL skip its content contribution, increment an unknown-record diagnostic, and continue importing later complete records

#### Scenario: Malformed complete record is encountered

- **WHEN** a newline-terminated record is invalid JSON or lacks required envelope fields
- **THEN** the system SHALL record a sanitized malformed-record diagnostic and continue with later records when the record boundary remains known

#### Scenario: Session identity cannot be established

- **WHEN** a supported source cannot yield a stable session identifier
- **THEN** the system SHALL not create or overwrite a session and SHALL report the source as failed

### Requirement: Serialized ingestion ownership

The system SHALL prevent concurrent import work from applying overlapping updates to the same source and SHALL preserve the backend's single-writer DuckDB ownership.

#### Scenario: Watch event arrives during backfill

- **WHEN** a watched source changes while that same source is being backfilled
- **THEN** the system SHALL queue or coalesce the later state and process it after the active import without running overlapping writes

#### Scenario: Rescan is requested during an active run

- **WHEN** an explicit rescan is requested while ingestion is already active
- **THEN** the system SHALL acknowledge the current or queued run and SHALL not start a competing database writer

### Requirement: Observable ingestion operations

The backend SHALL expose generated-contract operations for ingestion status, explicit rescan, paginated session summaries, and session details.

#### Scenario: Import status is requested

- **WHEN** a client requests the ingestion status
- **THEN** the response SHALL report each configured root's availability, current run state, last completed run time, discovered and imported counts, and sanitized warning or error summaries

#### Scenario: Explicit rescan is requested

- **WHEN** a client requests an authorized local rescan
- **THEN** the backend SHALL accept or coalesce the request and SHALL return the resulting run identity or current run state

#### Scenario: Session list is requested

- **WHEN** a client requests a page of imported sessions
- **THEN** the backend SHALL return deterministic pagination with session identity, current title, timestamps, developer turns, token totals, usage-observed status, and import status but no transcript content

#### Scenario: Existing session detail is requested

- **WHEN** a client requests an imported session by its stable identifier
- **THEN** the backend SHALL return its persisted metadata and normalized usage facts without transcript content

#### Scenario: Unknown session detail is requested

- **WHEN** a client requests a session identifier that is not persisted
- **THEN** the backend SHALL return the API's documented not-found response

### Requirement: Managed ingestion lifecycle

The backend SHALL start ingestion only after configuration, DuckDB initialization, and migrations succeed and SHALL stop accepting new ingestion work during graceful shutdown.

#### Scenario: Backend starts successfully

- **WHEN** the backend completes foundation initialization
- **THEN** it SHALL initialize source status, schedule historical discovery, and begin watching available roots

#### Scenario: Backend shuts down

- **WHEN** graceful shutdown begins
- **THEN** the system SHALL stop watchers, reject new rescan work, finish or safely roll back the active transaction, persist only committed checkpoints, and release ingestion resources before closing DuckDB
