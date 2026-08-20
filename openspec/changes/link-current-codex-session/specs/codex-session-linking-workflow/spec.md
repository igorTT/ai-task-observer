## Purpose

Lets a developer explicitly connect the current Codex task to the Linear issue declared in its
title while preserving stable session identity and existing committed attribution on uncertainty
or failure.

## ADDED Requirements

### Requirement: Explicit Codex invocation

The linking workflow SHALL be available as a repository-scoped Codex capability named
`$link-current-session` and SHALL run only after explicit user invocation. Invoking the workflow
SHALL apply only to the Codex task from which it was requested unless the user explicitly supplies
a stable session identifier to resolve an identity failure.

#### Scenario: User explicitly invokes the workflow

- **WHEN** a developer invokes `$link-current-session` from a Codex task
- **THEN** the workflow SHALL attempt to inspect and link that task's stable session identifier

#### Scenario: Prompt merely resembles a linking request

- **WHEN** a developer does not explicitly invoke `$link-current-session`
- **THEN** Codex SHALL NOT activate the workflow implicitly or mutate session attribution through it

### Requirement: Stable and unambiguous task identity

The workflow SHALL address observer sessions by their stable Codex task identifier. A task title
and working directory MAY be used to discover that identifier, but SHALL NOT be treated as durable
identity. Discovery SHALL produce exactly one eligible task or stop without contacting the relink
operation.

#### Scenario: Current task identifier is available

- **WHEN** the Codex host provides the stable identifier of the task containing the invocation
- **THEN** the workflow SHALL use that identifier without searching for another task by title

#### Scenario: Discovery finds one matching task

- **WHEN** current-task context is unavailable and task discovery finds exactly one eligible task
  matching the current repository and expected title
- **THEN** the workflow SHALL use the discovered task's stable identifier and SHALL report that
  discovery was used

#### Scenario: Duplicate task titles are found

- **WHEN** task discovery finds more than one eligible task with the expected title
- **THEN** the workflow SHALL report the ambiguity, identify the candidates safely, and SHALL NOT
  select one by recency or invoke the observer relink operation

#### Scenario: No task can be resolved

- **WHEN** neither current-task context nor unambiguous discovery yields a stable identifier
- **THEN** the workflow SHALL stop with instructions to provide or select an exact session
  identifier and SHALL NOT mutate attribution

### Requirement: Observer session readiness

The workflow SHALL inspect the selected session through the observer HTTP API before requesting a
link. When the observer does not yet know a valid Codex task identifier, the workflow SHALL tolerate
only a bounded ingestion delay and at most one explicit rescan request before reporting that the
session remains unavailable.

#### Scenario: Session is already imported

- **WHEN** the observer returns session detail for the selected identifier
- **THEN** the workflow SHALL continue without requesting an ingestion rescan

#### Scenario: Active session import is delayed

- **WHEN** the selected identifier is initially unknown to the observer but becomes available
  within the bounded readiness procedure
- **THEN** the workflow SHALL continue using the imported session with the same stable identifier

#### Scenario: Session remains unknown after bounded recovery

- **WHEN** the observer still returns session not found after the bounded wait and optional rescan
- **THEN** the workflow SHALL report that ingestion has not observed the task, stop retrying, and
  SHALL NOT request relinking

#### Scenario: Observer is unavailable

- **WHEN** the configured observer endpoint cannot be reached or returns a non-API response
- **THEN** the workflow SHALL fail within a bounded time with startup and endpoint guidance and
  SHALL NOT attempt direct file, database, or Linear access

### Requirement: Attribution preflight and confirmation

Before requesting relinking, the workflow SHALL present the imported session title, parsed issue
candidate and phase, and current committed issue link. It SHALL require an additional explicit user
confirmation before replacing a committed link whose issue identifier differs from the current
title candidate.

#### Scenario: Unlinked session has a valid candidate

- **WHEN** the selected session is unlinked and its current title contains a valid issue candidate
- **THEN** the workflow SHALL present the candidate and MAY proceed under the original explicit
  invocation without a second confirmation

#### Scenario: Existing link matches the title candidate

- **WHEN** the selected session is already committed to the same issue declared by its current
  title
- **THEN** the workflow SHALL report an idempotent already-linked outcome and SHALL NOT request a
  replacement

#### Scenario: Existing link differs from the title candidate

- **WHEN** the selected session has a committed issue link different from its valid current title
  candidate
- **THEN** the workflow SHALL show both identifiers and SHALL NOT request relinking until the user
  explicitly confirms replacement

#### Scenario: User declines replacement

- **WHEN** the workflow requests confirmation for a different committed link and the user declines
  or does not provide confirmation
- **THEN** the workflow SHALL preserve the current link and finish without invoking relinking

#### Scenario: Current title has no valid candidate

- **WHEN** the selected session's current title does not provide a valid Linear issue candidate
- **THEN** the workflow SHALL explain the required title convention and SHALL NOT accept an
  arbitrary replacement issue identifier

### Requirement: Server-owned title-derived linking

The workflow SHALL use the observer's explicit relink operation to establish or replace
attribution. It SHALL send only the stable session identifier and SHALL let the observer re-read the
current imported title, resolve the exact Linear issue, and commit the link.

#### Scenario: Unlinked session is linked successfully

- **WHEN** the user explicitly invokes the workflow for an unlinked session and the observer
  successfully resolves its current title candidate
- **THEN** the workflow SHALL report the committed issue identifier, title, optional phase, and
  session identifier returned by the observer

#### Scenario: Confirmed replacement succeeds

- **WHEN** the user confirms replacing a different committed link and the observer completes the
  relink
- **THEN** the workflow SHALL report the previous and newly committed issue identifiers

#### Scenario: Title changes during the operation

- **WHEN** the imported title changes after preflight and the observer rejects the stale relink
  attempt
- **THEN** the workflow SHALL report that the title must be inspected again and SHALL NOT retry the
  mutation automatically

#### Scenario: Linear cannot resolve the candidate

- **WHEN** the observer reports unconfigured Linear access, a missing issue, authentication
  failure, rate limiting, network failure, server failure, or identifier mismatch
- **THEN** the workflow SHALL report the observer's sanitized outcome and SHALL NOT bypass the
  observer or substitute another issue

### Requirement: Deterministic workflow interface

The script-backed workflow SHALL accept an explicit session identifier and observer base URL,
SHALL provide a loopback observer URL as the local default, and SHALL expose stable result
categories that the Codex skill can translate into concise user guidance. Successful no-op and
mutation outcomes SHALL be distinguishable from identity, readiness, confirmation, validation,
and server failures.

#### Scenario: Default local observer is used

- **WHEN** no observer URL override is configured
- **THEN** the workflow SHALL contact the documented loopback backend endpoint

#### Scenario: Observer URL is configured

- **WHEN** a developer supplies a supported observer base URL through the documented configuration
- **THEN** the workflow SHALL use that endpoint consistently for preflight, optional rescan, and
  relink requests

#### Scenario: Skill consumes a script result

- **WHEN** the deterministic script completes
- **THEN** it SHALL return a stable result category and a non-sensitive summary sufficient for the
  skill to report the outcome without parsing incidental prose

### Requirement: Privacy and ownership boundaries

The Codex-side workflow SHALL communicate only with the configured observer HTTP API. It SHALL NOT
read Codex session JSONL files, open DuckDB, call Linear, accept Linear credentials, or include
message content, reasoning, tool data, credentials, or raw upstream responses in its output or
diagnostics.

#### Scenario: Linking requires Linear resolution

- **WHEN** the selected session's issue candidate needs resolution
- **THEN** only the observer backend SHALL call Linear and persist attribution

#### Scenario: A request fails with sensitive upstream details

- **WHEN** the observer or another local component produces an error containing non-permitted data
- **THEN** the workflow SHALL emit only a bounded sanitized category and user-actionable summary

#### Scenario: Developer attempts to provide Linear credentials

- **WHEN** credentials are passed to the workflow instead of being configured on the observer
- **THEN** the workflow SHALL reject or ignore them and direct the developer to observer
  configuration without echoing their value
