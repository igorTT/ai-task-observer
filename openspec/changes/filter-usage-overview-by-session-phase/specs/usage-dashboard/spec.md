## ADDED Requirements

### Requirement: Current session phase selection

The overview SHALL provide one single-select current-session-phase control with All, every
canonical phase, and Unassigned. The selected phase and selected range SHALL control the token and
cost counters, charts, exact bucket data, completeness, warnings, and unknown-time notice together.
All SHALL be the initial and fallback selection; each non-default selection SHALL be represented in
URL state and sent through the generated timeline client.

#### Scenario: Overview opens without phase state

- **WHEN** a user opens `/overview` without a phase query value
- **THEN** the dashboard SHALL visibly select All and request the timeline without a session-phase filter

#### Scenario: User selects proposal

- **WHEN** the user selects Proposal as the current session phase
- **THEN** the dashboard SHALL update the URL, request the `proposal` session-phase timeline, and update all overview values from that response

#### Scenario: User selects unassigned

- **WHEN** the user selects Unassigned
- **THEN** the dashboard SHALL request the reporting-only unassigned population without presenting it as explicit `other`

#### Scenario: URL phase is invalid

- **WHEN** the overview URL contains a malformed or unsupported phase value
- **THEN** the dashboard SHALL normalize to All without issuing an unsupported timeline request

#### Scenario: Browser navigation restores phase

- **WHEN** the user navigates backward or forward after changing current session phase
- **THEN** the selector and every overview value SHALL restore the range and phase represented by the resulting URL

#### Scenario: Current assignment semantics are explained

- **WHEN** the overview displays a phase-filtered timeline
- **THEN** accessible UI copy SHALL identify it as usage from sessions currently assigned to that phase rather than phase-at-event history

### Requirement: Phase mutation refreshes phase-dependent reads

After the frontend successfully assigns, replaces, or clears a session phase through the generated
phase API, subscribed session, issue-usage, and usage-timeline reads SHALL refresh so current-phase
classification is not displayed from stale cache state.

#### Scenario: Session phase changes while a timeline is subscribed

- **WHEN** a generated phase mutation succeeds while one or more timeline selections are subscribed
- **THEN** the frontend SHALL refresh the subscribed timelines and the session and issue-usage reads without requesting import or cost recalculation
