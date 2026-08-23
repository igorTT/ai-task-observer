## MODIFIED Requirements

### Requirement: Explicit user-controlled relinking

The system SHALL replace an established session-to-issue link only through an explicit
user-initiated relink operation. The operation SHALL accept a stable session identifier and an
explicit Linear issue identifier, perform exact Linear resolution, and commit the link only after
successful resolution. It SHALL NOT derive the requested issue from the current session title.

#### Scenario: User confirms a changed title candidate

- **WHEN** a session remains linked to `ENG-215` and the user explicitly requests relinking to
  `ENG-216`
- **THEN** the system SHALL resolve `ENG-216` exactly and, on success, atomically replace the stored
  link with `ENG-216`

#### Scenario: Relink candidate is invalid or absent

- **WHEN** the user requests relinking without a syntactically valid issue identifier
- **THEN** the system SHALL reject the relink with a documented validation error and SHALL preserve
  the existing link

#### Scenario: Relink target is not found

- **WHEN** the user requests relinking and Linear reports that the supplied issue identifier does
  not exist or is inaccessible
- **THEN** the system SHALL report `not_found` for the relink attempt and preserve the existing link

#### Scenario: Relink resolution fails

- **WHEN** the user requests relinking and exact resolution fails because of authentication,
  timeout, rate limiting, network failure, server failure, or an identifier mismatch
- **THEN** the system SHALL report a sanitized failure and preserve the existing link

#### Scenario: Unlinked session is explicitly linked

- **WHEN** the user supplies a valid issue identifier for an unlinked session and explicitly
  requests relinking
- **THEN** the system SHALL resolve the supplied identifier exactly and, on success, establish it
  as the session's current link

#### Scenario: Session is already linked to the requested issue

- **WHEN** the user explicitly requests the issue already committed to the session
- **THEN** the operation SHALL succeed idempotently without creating another attribution

#### Scenario: Distinct sessions link to the same requested issue

- **WHEN** the user explicitly links two different sessions to the same valid issue identifier
- **THEN** both operations SHALL succeed and each session SHALL independently reference the same
  cached Linear issue

## ADDED Requirements

### Requirement: Current Codex session linking inputs

The Codex workflow SHALL operate on exactly two logical inputs: the stable current session
identifier and an explicit Linear issue identifier supplied by the developer. It SHALL NOT derive
identity from title text or recency and SHALL NOT derive the issue identifier from the session
title.

#### Scenario: Developer links the current session

- **WHEN** a developer explicitly invokes `$link-current-session` with `ENG-215`
- **THEN** the workflow SHALL use the host-provided stable identifier for the current session and
  `ENG-215` as the requested Linear issue identifier

#### Scenario: Ticket identifier is missing or invalid

- **WHEN** the invocation does not include a syntactically valid Linear issue identifier
- **THEN** the workflow SHALL stop with concise usage guidance and SHALL NOT call the mutation API

#### Scenario: Current session identity is unavailable

- **WHEN** the Codex host does not provide a stable identifier for the current session
- **THEN** the workflow SHALL request the exact stable session identifier rather than guess

### Requirement: Single observer mutation

For a valid invocation, the Codex workflow SHALL submit one relink request containing the session
identifier and requested issue identifier. It SHALL NOT perform an inspection request, trigger an
ingestion rescan, poll for readiness, re-read attribution, or require a second confirmation before
mutation.

#### Scenario: Valid explicit invocation

- **WHEN** the workflow has a stable session identifier and a valid issue identifier
- **THEN** it SHALL call `POST /api/sessions/{sessionId}/relink` once with the normalized
  `issueIdentifier` in the request body

#### Scenario: Observer cannot find the session

- **WHEN** the observer reports that the supplied session identifier is not imported
- **THEN** the workflow SHALL report that outcome and allow a later retry without initiating a
  rescan

### Requirement: Backend-owned direct relinking

The observer backend SHALL validate the supplied issue identifier, resolve the exact accessible
Linear issue, verify that the returned identifier matches the request, and persist the link
atomically. The previous committed link SHALL remain unchanged whenever validation, resolution, or
persistence fails.

#### Scenario: Requested issue resolves exactly

- **WHEN** Linear returns an accessible issue whose normalized identifier exactly matches the
  requested identifier
- **THEN** the observer SHALL cache the permitted issue summary and atomically commit the session
  link

#### Scenario: Cached issue metadata is refreshed after a link exists

- **WHEN** an issue summary is resolved again after one or more sessions already reference that
  issue
- **THEN** the observer SHALL refresh the permitted metadata without removing or preventing any
  session link

#### Scenario: Linear returns a different identifier

- **WHEN** Linear returns an issue whose normalized identifier differs from the request
- **THEN** the observer SHALL reject the operation and preserve the previous link

#### Scenario: Linear resolution or persistence fails

- **WHEN** remote resolution or local persistence prevents completion
- **THEN** the observer SHALL return a sanitized failure and preserve the previous link

### Requirement: Concise privacy-safe workflow result

The Codex workflow SHALL report the stable session identifier and linked issue identifier after
success, or a concise actionable authored API error after failure. It SHALL communicate only with
the configured observer HTTP API and SHALL NOT read Codex session JSONL, open DuckDB, call Linear
directly, accept credentials, or expose non-permitted data.

#### Scenario: Link succeeds

- **WHEN** the observer commits the requested link
- **THEN** the workflow SHALL report the session identifier and committed Linear issue identifier

#### Scenario: Observer is unavailable

- **WHEN** the observer API cannot be reached
- **THEN** the workflow SHALL tell the developer to start or check the observer and retry

#### Scenario: Linking requires Linear resolution

- **WHEN** the requested issue needs resolution
- **THEN** only the observer backend SHALL call Linear and persist attribution

#### Scenario: A request fails with sensitive upstream details

- **WHEN** an upstream failure contains non-permitted data
- **THEN** the backend and workflow SHALL expose only the authored sanitized error response
