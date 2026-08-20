## MODIFIED Requirements

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
