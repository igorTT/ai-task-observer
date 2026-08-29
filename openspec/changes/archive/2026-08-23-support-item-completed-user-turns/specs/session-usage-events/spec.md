## MODIFIED Requirements

### Requirement: Selected structured event persistence

The system SHALL persist supported legacy and current explicit user-message events,
assistant-message events, model-context events, and token-usage events with stable session and
source-record identity. User and assistant message content MAY be persisted for the internal POC,
but reasoning content, tool arguments, tool results, credentials, opaque full source records, and
malformed-record payloads SHALL NOT be persisted or exposed.

#### Scenario: Legacy explicit user message is imported

- **WHEN** a source contains a supported legacy explicit user-message event
- **THEN** the system SHALL persist its user role, source identity, event time, and permitted
  message content

#### Scenario: Current explicit user message is imported

- **WHEN** a source contains a supported item-completed event whose completed item is a user
  message
- **THEN** the system SHALL persist its user role, source identity, event time, and permitted
  message content

#### Scenario: Supported messages are imported

- **WHEN** a source contains supported user and assistant message events
- **THEN** the system SHALL persist their roles, source identity, event time, and message content

#### Scenario: Mirrored user record is imported

- **WHEN** a user submission appears as an explicit user-message event and a mirrored user
  response item
- **THEN** the system SHALL retain one canonical developer-turn event and SHALL NOT double-count
  the mirror

#### Scenario: Excluded content is imported

- **WHEN** a supported source contains reasoning, tool-argument, tool-result, credential, or
  malformed-record content
- **THEN** the system SHALL omit that content while retaining only permitted metadata and
  sanitized diagnostics

#### Scenario: Malformed completed user item is imported

- **WHEN** an item-completed record does not contain the required user-message item shape or
  permitted message content
- **THEN** the system SHALL derive no message fact or developer turn from that record and SHALL
  not persist or expose its opaque payload

### Requirement: Developer-turn facts

The system SHALL derive one developer turn from each supported explicit user-message event,
including legacy user-message events and current item-completed user-message events, and SHALL
derive no turns from system, developer, assistant, tool, approval, mirrored response-item, or
control events.

#### Scenario: Mixed event roles are imported

- **WHEN** a session contains supported explicit user messages in legacy or current source formats
  and any number of non-user events
- **THEN** the normalized session facts SHALL report exactly one developer turn for each explicit
  user message

#### Scenario: Mirrored and injected roles are excluded

- **WHEN** a source contains mirrored user response items plus system, developer, assistant, tool,
  approval, or control records
- **THEN** none of those records SHALL increase the developer-turn total

#### Scenario: Existing event is reprocessed

- **WHEN** an already committed explicit user-message source record is encountered again
- **THEN** the persisted event and developer-turn total SHALL remain unchanged

#### Scenario: Existing source is rebuilt with current parser support

- **WHEN** a parser-version upgrade rebuilds a source containing supported item-completed user
  messages
- **THEN** the rebuilt selected events and derived developer-turn total SHALL include those user
  messages exactly once
