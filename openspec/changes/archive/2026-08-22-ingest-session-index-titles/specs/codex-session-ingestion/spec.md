## MODIFIED Requirements

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

- **WHEN** a previously imported stable session identifier is discovered through an updated or
  relocated source path
- **THEN** the system SHALL update the existing session's source metadata rather than create a
  duplicate session

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

## ADDED Requirements

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
