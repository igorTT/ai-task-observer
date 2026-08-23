## Purpose

Connects imported Codex Desktop sessions to Linear issues through an explicit identifier in the session title, while keeping established links under explicit user control and preserving reliable, privacy-safe attribution states when Linear is unavailable or not configured.

## Requirements

### Requirement: Deterministic title convention

The system SHALL use the developer-controlled Codex chat title as the attribution control surface. It SHALL treat a session title as attributable only when its trimmed value starts with a Linear-style identifier composed of a letter-led alphanumeric team key, a hyphen, and a positive decimal issue number, followed by either the end of the title or a colon and optional phase text. The system SHALL normalize the candidate identifier to uppercase and SHALL NOT use semantic inference.

#### Scenario: New chat retains its default title
- **WHEN** a newly imported Codex chat still has a default title that does not match the attribution convention
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT infer a Linear issue or query Linear for that title

#### Scenario: Developer renames a default-title chat
- **WHEN** the developer renames an imported unlinked chat from its default title to `ENG-215: explore` and ingestion observes the updated title
- **THEN** the system SHALL produce candidate identifier `ENG-215` with phase `explore` and SHALL schedule or perform exact Linear resolution without recreating the session

#### Scenario: Identifier-only title
- **WHEN** an imported session title is `ENG-215`
- **THEN** the system SHALL produce candidate identifier `ENG-215` with no phase

#### Scenario: Identifier and phase title
- **WHEN** an imported session title is `eng-215:  apply `
- **THEN** the system SHALL produce candidate identifier `ENG-215` and trimmed phase `apply`

#### Scenario: Empty phase suffix
- **WHEN** an imported session title is `ENG-215:`
- **THEN** the system SHALL produce candidate identifier `ENG-215` with no phase

#### Scenario: Identifier is not leading
- **WHEN** an imported session title contains `ENG-215` anywhere other than the beginning after trimming
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT query Linear for that title

#### Scenario: Unexpected text follows identifier
- **WHEN** an imported session title is `ENG-215 apply` without the required colon separator
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT guess an identifier or phase

### Requirement: Optional Linear configuration

The backend SHALL accept Linear credentials through validated environment configuration, SHALL never persist or expose those credentials, and SHALL remain operational when Linear is not configured.

#### Scenario: Linear is not configured
- **WHEN** the backend starts without Linear credentials
- **THEN** normal backend health and Codex ingestion SHALL remain available, the Linear integration SHALL report `unconfigured`, and parsed candidates SHALL remain unresolved without outbound Linear requests

#### Scenario: Linear credentials are configured
- **WHEN** the backend starts with syntactically valid Linear credentials
- **THEN** the Linear integration SHALL initialize and SHALL be eligible to resolve parsed issue identifiers

#### Scenario: Linear rejects configured credentials
- **WHEN** Linear rejects an authenticated request
- **THEN** the backend SHALL remain operational, SHALL report an authentication failure without exposing the credential, and SHALL preserve imported sessions and their previous committed attribution data

### Requirement: Exact Linear issue resolution

The system SHALL resolve a parsed candidate identifier to the exact accessible Linear issue returned for that identifier and SHALL distinguish successful resolution, confirmed absence, and retryable failure.

#### Scenario: Candidate resolves successfully
- **WHEN** Linear returns an accessible issue whose normalized identifier exactly matches the parsed candidate
- **THEN** the system SHALL mark the session linked to that issue and SHALL cache the permitted issue summary metadata

#### Scenario: Candidate does not exist or is inaccessible
- **WHEN** Linear authoritatively reports that no accessible issue exists for a candidate identifier
- **THEN** the system SHALL mark the attribution `not_found` and SHALL retain the candidate identifier for later synchronization

#### Scenario: Linear request fails transiently
- **WHEN** issue resolution fails because of a timeout, rate limit, network error, or server error
- **THEN** the system SHALL mark the attempt as a retryable failure and SHALL NOT convert it into `not_found` or discard a previously committed link

#### Scenario: Returned identifier does not match candidate
- **WHEN** a Linear response does not exactly match the normalized candidate identifier
- **THEN** the system SHALL refuse the link and SHALL report a sanitized resolution failure

#### Scenario: Several sessions reference one issue
- **WHEN** multiple sessions contain the same candidate identifier
- **THEN** each session SHALL link independently to the same cached Linear issue and the system SHALL avoid unnecessary duplicate concurrent lookups

### Requirement: Minimal privacy-safe Linear cache

The system SHALL persist only the Linear issue identity and summary metadata required to display and aggregate attributed work, together with synchronization timestamps and sanitized status information.

#### Scenario: Issue metadata is cached
- **WHEN** an issue resolves successfully
- **THEN** the persisted cache SHALL contain its Linear ID, identifier, title, URL, minimal team and workflow-state summary, Linear update timestamp, and local synchronization timestamp

#### Scenario: Sensitive or unnecessary issue content is returned
- **WHEN** Linear returns descriptions, comments, attachments, or other content outside the permitted summary
- **THEN** the system SHALL not persist or expose that content through the attribution API

#### Scenario: Diagnostic information is recorded
- **WHEN** a Linear operation fails
- **THEN** persisted and returned diagnostics SHALL use sanitized categories and timestamps without credentials, authorization headers, raw response bodies, or issue content

### Requirement: Single current attribution per session

The system SHALL persist exactly one current attribution state for each imported session, independently of the ingestion-owned session record and usage facts. A successfully established issue link SHALL remain authoritative until the user explicitly relinks it. Ingestion SHALL parse later title changes as current title candidates but SHALL NOT replace or clear an existing issue link from a title change alone.

#### Scenario: Newly imported session has a valid candidate
- **WHEN** ingestion commits a session with no established issue link whose title matches the attribution convention
- **THEN** the system SHALL persist the candidate and phase and SHALL schedule or perform resolution without changing the session's usage facts

#### Scenario: Newly imported session has no candidate
- **WHEN** ingestion commits a new session whose title does not match the attribution convention
- **THEN** the system SHALL persist an `unlinked` attribution state for that session

#### Scenario: Title changes to another identifier
- **WHEN** a session linked to `ENG-215` is renamed to a title with candidate identifier `ENG-216`
- **THEN** the system SHALL preserve the `ENG-215` link, record or expose `ENG-216` as the current title candidate, and SHALL NOT resolve or link `ENG-216` until the user explicitly requests relinking

#### Scenario: Title changes to an unlinked title
- **WHEN** an existing linked session title no longer matches the attribution convention
- **THEN** the system SHALL preserve its current issue link, expose that the current title has no candidate, and preserve all ingestion-owned session and usage data

#### Scenario: Only phase changes
- **WHEN** a session title retains the same candidate identifier but changes its phase suffix
- **THEN** the system SHALL update the phase metadata without changing the established issue link or creating a second attribution

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

- **WHEN** the user requests relinking and exact resolution fails because of authentication, timeout, rate limiting, network failure, server failure, or an identifier mismatch
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

### Requirement: Existing-session reconciliation

The system SHALL reconcile attribution for previously imported sessions when configured Linear access becomes available and through an explicit synchronization operation.

#### Scenario: Configured backend starts with existing sessions
- **WHEN** the backend starts with Linear configured and imported sessions already exist
- **THEN** it SHALL reconcile unlinked sessions and refresh established issue metadata without replacing a stored link because its current title candidate changed

#### Scenario: Explicit synchronization is requested
- **WHEN** a client requests Linear synchronization
- **THEN** the backend SHALL accept or coalesce the request, return the active or queued synchronization identity, and reconcile eligible candidates without starting an overlapping DuckDB writer

#### Scenario: Previously missing issue becomes available
- **WHEN** a later synchronization successfully resolves a candidate previously marked `not_found`
- **THEN** the session SHALL become linked without requiring a title change or session re-import

#### Scenario: Cached issue metadata changes
- **WHEN** synchronization returns newer permitted summary metadata for a linked issue
- **THEN** the cache SHALL update while preserving every session linked to that Linear issue

#### Scenario: Synchronization sees a renamed linked session
- **WHEN** synchronization observes that a linked session's current title candidate differs from its stored issue link
- **THEN** the system SHALL preserve the stored link, expose the changed candidate for user review, and SHALL NOT resolve or assign that candidate automatically

### Requirement: Read-only Linear behavior

The system SHALL use Linear only to read issue and integration-status data and SHALL NOT mutate Linear issues as part of attribution.

#### Scenario: Session becomes linked
- **WHEN** a session is successfully attributed to an issue
- **THEN** the system SHALL not update the issue, create a comment, add a label, change its state, or otherwise write to Linear

### Requirement: Observable attribution API

The backend SHALL expose generated-contract attribution data on session responses and operations for Linear integration status and explicit synchronization.

#### Scenario: Session list is requested
- **WHEN** a client requests imported session summaries
- **THEN** each session response SHALL distinguish its current title candidate from its stored issue link and include attribution status, optional phase, linked issue summary when available, and whether explicit relinking is required to apply a differing candidate

#### Scenario: Session detail is requested
- **WHEN** a client requests an imported session by its stable identifier
- **THEN** the response SHALL include the current attribution, last resolution attempt time, synchronization state, and sanitized failure category without transcript or unnecessary Linear content

#### Scenario: Linear status is requested
- **WHEN** a client requests Linear integration status
- **THEN** the response SHALL report configured state, current synchronization state, last completed synchronization time, candidate and outcome counts, and sanitized warnings or errors

#### Scenario: Synchronization is requested while unconfigured
- **WHEN** a client requests Linear synchronization without configured credentials
- **THEN** the backend SHALL reject the operation with the documented configuration error while leaving ingestion and health operations available

#### Scenario: Relinking is requested
- **WHEN** a client explicitly requests relinking for a session
- **THEN** the backend SHALL return the committed replacement attribution on success or a documented sanitized error while preserving the previous link on failure

### Requirement: Attribution lifecycle isolation

Linear attribution SHALL begin only after foundation initialization and SHALL stop accepting new synchronization work during graceful shutdown without compromising committed ingestion or attribution data.

#### Scenario: Backend initialization succeeds
- **WHEN** configuration, DuckDB initialization, migrations, and session ingestion initialization succeed
- **THEN** the system SHALL initialize attribution state and, when Linear is configured, schedule reconciliation of eligible sessions

#### Scenario: Graceful shutdown begins
- **WHEN** the backend begins graceful shutdown
- **THEN** attribution SHALL reject new synchronization requests, complete or safely roll back active persistence work, and release Linear synchronization resources before DuckDB closes
