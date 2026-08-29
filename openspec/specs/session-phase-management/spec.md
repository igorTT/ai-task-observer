# session-phase-management Specification

## Purpose

Provide a stable, explicitly assigned workflow phase for every session so clients can manage phase
metadata consistently and future reporting can group sessions without free-form-value drift.

## Requirements

### Requirement: Canonical session phase vocabulary

The system SHALL represent an assigned session phase as exactly one of `research`, `explore`,
`proposal`, `apply`, `verify`, `quick-flow`, or `other`. An unassigned phase SHALL be distinct from
the explicitly assigned `other` phase.

#### Scenario: Canonical phase is assigned
- **WHEN** a client assigns any value from the canonical phase vocabulary
- **THEN** the system SHALL persist and return that exact phase for the session

#### Scenario: Other phase is assigned
- **WHEN** a client assigns `other`
- **THEN** the system SHALL persist `other` as an explicit phase rather than treating the session as unassigned

#### Scenario: Phase is unassigned
- **WHEN** a session has no assigned phase
- **THEN** session and issue-usage responses SHALL expose the phase as absent or null according to their existing response shape

### Requirement: Explicit phase mutation

The backend SHALL expose a generated-contract operation that accepts a stable session identifier
and either one canonical phase or null. The operation SHALL replace the current phase without
changing session usage, import state, title candidate, or committed Linear issue attribution.

#### Scenario: Assign phase to an existing session
- **WHEN** a client assigns `apply` to an existing session
- **THEN** the backend SHALL commit `apply` and return the session's updated attribution

#### Scenario: Replace an assigned phase
- **WHEN** a client assigns `verify` to a session currently assigned `apply`
- **THEN** the backend SHALL replace `apply` with `verify` without changing the session's issue link

#### Scenario: Clear an assigned phase
- **WHEN** a client submits null for a session with an assigned phase
- **THEN** the backend SHALL clear the phase and return an updated attribution with no phase

#### Scenario: Reject unsupported phase
- **WHEN** a client submits a non-null value outside the canonical phase vocabulary
- **THEN** the backend SHALL reject the request with a documented validation error and preserve the current phase

#### Scenario: Session does not exist
- **WHEN** a client attempts to mutate the phase of an unknown session identifier
- **THEN** the backend SHALL return the documented not-found error without creating attribution data

### Requirement: Explicit phase remains authoritative

The explicitly assigned phase SHALL remain unchanged across subsequent session imports, title
changes, Linear synchronization, and issue relinking until another explicit phase mutation replaces
or clears it.

#### Scenario: Imported title changes
- **WHEN** ingestion observes a new title for a session with an assigned phase
- **THEN** attribution reconciliation SHALL preserve the assigned phase regardless of title suffix text

#### Scenario: Session is relinked
- **WHEN** a session with an assigned phase is explicitly relinked to another Linear issue
- **THEN** the relink SHALL preserve the assigned phase

### Requirement: Legacy phase migration

The system SHALL migrate previously persisted free-form phase values into the canonical vocabulary
without preventing database startup. Exact canonical values SHALL remain unchanged, every other
non-empty value SHALL become `other`, and absent values SHALL remain unassigned.

#### Scenario: Existing canonical value is migrated
- **WHEN** migration encounters a stored phase equal to `explore`
- **THEN** the session SHALL retain `explore`

#### Scenario: Existing free-form value is migrated
- **WHEN** migration encounters a non-empty stored phase outside the canonical vocabulary
- **THEN** the session SHALL receive the canonical `other` phase

#### Scenario: Existing phase is absent
- **WHEN** migration encounters a null stored phase
- **THEN** the session SHALL remain unassigned
