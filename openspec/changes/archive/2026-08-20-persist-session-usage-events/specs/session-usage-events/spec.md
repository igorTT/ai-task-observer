## Purpose

Provides auditable structured Codex session events and normalized usage facts so later pricing and
issue aggregation can rely on explicit model, time, provenance, and completeness semantics.

## ADDED Requirements

### Requirement: Selected structured event persistence

The system SHALL persist supported user-message, assistant-message, model-context, and token-usage
events with stable session and source-record identity. User and assistant message content MAY be
persisted for the internal POC, but reasoning content, tool arguments, tool results, credentials,
opaque full source records, and malformed-record payloads SHALL NOT be persisted or exposed.

#### Scenario: Supported messages are imported

- **WHEN** a source contains supported user and assistant message events
- **THEN** the system SHALL persist their roles, source identity, event time, and message content

#### Scenario: Mirrored user record is imported

- **WHEN** a user submission appears as both an explicit user-message event and a mirrored user response item
- **THEN** the system SHALL retain one canonical developer-turn event and SHALL NOT double-count the mirror

#### Scenario: Excluded content is imported

- **WHEN** a supported source contains reasoning, tool-argument, tool-result, credential, or malformed-record content
- **THEN** the system SHALL omit that content while retaining only permitted metadata and sanitized diagnostics

### Requirement: Developer-turn facts

The system SHALL derive one developer turn from each explicit user-message event and SHALL derive
no turns from system, developer, assistant, tool, approval, mirror, or control events.

#### Scenario: Mixed event roles are imported

- **WHEN** a session contains two explicit user messages and any number of other supported events
- **THEN** the normalized session facts SHALL report exactly two developer turns

#### Scenario: Existing event is reprocessed

- **WHEN** an already committed user-message source record is encountered again
- **THEN** the persisted event and developer-turn total SHALL remain unchanged

### Requirement: Token category invariants

The system SHALL treat cached input as a subset of input, SHALL derive uncached input as input minus
cached input, and SHALL derive total tokens as input plus output. Cached input SHALL NOT be added to
input when calculating total tokens.

#### Scenario: Valid categories are normalized

- **WHEN** an observation reports 100 input tokens, including 20 cached input tokens, and 30 output tokens
- **THEN** it SHALL normalize to 80 uncached input, 20 cached input, and 130 total tokens

#### Scenario: Session contains multiple observations

- **WHEN** a session contains valid normalized deltas from multiple token observations
- **THEN** each session category SHALL equal the sum of that category's normalized deltas

### Requirement: Cumulative observation normalization

The system SHALL preserve source-reported cumulative and last-usage counters and SHALL calculate a
single non-duplicated normalized delta for each supported token observation.

#### Scenario: Cumulative counters increase

- **WHEN** a cumulative snapshot is component-wise greater than or equal to the previous snapshot in its epoch
- **THEN** the normalized delta SHALL equal the current snapshot minus the previous snapshot

#### Scenario: Cumulative snapshot repeats

- **WHEN** an observation repeats the previous cumulative snapshot
- **THEN** its normalized delta SHALL be zero

#### Scenario: Last usage accompanies a valid cumulative difference

- **WHEN** an observation contains both a valid cumulative difference and `last_token_usage`
- **THEN** the system SHALL use the cumulative difference exactly once and SHALL NOT add `last_token_usage` again

#### Scenario: Reported last usage disagrees

- **WHEN** `last_token_usage` disagrees with an otherwise valid cumulative difference
- **THEN** the system SHALL retain the cumulative difference and record a mismatch anomaly

#### Scenario: Cumulative counters decrease

- **WHEN** any cumulative category decreases relative to the prior snapshot
- **THEN** the system SHALL start a new observation epoch, record a reset anomaly, and use valid `last_token_usage` as that observation's delta

#### Scenario: Decrease has no valid last usage

- **WHEN** cumulative counters decrease and no valid `last_token_usage` is available
- **THEN** the system SHALL infer no delta for that observation and mark the affected accounting incomplete

### Requirement: Explicit model and event time

Every normalized usage delta SHALL be associated with the active exact source model and UTC event
timestamp when known. Missing model or time SHALL be represented explicitly as `unknown` and SHALL
not be filled from session creation, import, file, or current-clock timestamps.

#### Scenario: Model changes within a session

- **WHEN** model-context events select different models before separate usage observations
- **THEN** each normalized delta SHALL retain the model active at its observation

#### Scenario: Observation has no known model

- **WHEN** no model context applies to a usage observation
- **THEN** its normalized model SHALL be `unknown`

#### Scenario: Event timestamp is missing or invalid

- **WHEN** a supported event has no valid source timestamp
- **THEN** its event time SHALL remain unknown without a synthesized fallback

### Requirement: Honest malformed-counter handling

The system SHALL preserve malformed source counters for audit, SHALL NOT clamp or take their
absolute values, and SHALL represent affected normalized categories as unknown rather than zero.
Unaffected categories MAY remain known.

#### Scenario: Counter is negative

- **WHEN** a source reports a negative token counter
- **THEN** that category SHALL be unknown and anomalous while independently valid categories remain usable

#### Scenario: Cached input exceeds input

- **WHEN** cached input exceeds input for a source observation or normalized delta
- **THEN** cached and uncached input SHALL be unknown, input and output MAY remain valid, and total tokens SHALL remain input plus output when both are known

#### Scenario: Aggregate includes an unknown category

- **WHEN** any contributing normalized delta has an unknown value for a requested token category
- **THEN** that aggregate category SHALL be null and its token-completeness flag SHALL be false

### Requirement: Usage observation provenance

Each persisted observation SHALL retain enough provenance to explain its raw counters and
normalized delta, including session identity, source-record identity or position, parser version,
model, event time, normalization epoch, anomaly codes, and completeness state.

#### Scenario: Observation is inspected

- **WHEN** downstream accounting loads a normalized observation
- **THEN** it SHALL be able to identify the source record and normalization inputs that produced it

#### Scenario: Usage is absent

- **WHEN** a valid session has no supported token observations
- **THEN** the session SHALL remain importable with explicit `usageObserved: false` and unknown usage rather than fabricated zero usage

### Requirement: Atomic fact replacement

When ingestion rebuilds a source, the system SHALL atomically replace all selected events and
derived usage facts owned by that source while preserving the last valid committed version on
failure.

#### Scenario: Source rebuild succeeds

- **WHEN** a source replacement or parser-version change is rebuilt successfully
- **THEN** its old selected events and usage facts SHALL be replaced without duplicates in the same commit as its checkpoint

#### Scenario: Source rebuild fails

- **WHEN** rebuilding selected events or usage facts fails before commit
- **THEN** the previously committed events, usage facts, totals, and checkpoint SHALL remain visible
