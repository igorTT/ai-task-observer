# Usage Dashboard Specification

## Purpose

Provides a local, trustworthy interface for inspecting Codex usage by Linear issue, reviewing
session attribution, and operating the existing import, synchronization, and cost workflows.

## Requirements

### Requirement: Routed dashboard navigation

The dashboard SHALL provide stable routes for the issue-usage overview, one issue's usage detail,
and the imported-session list. The root route SHALL lead to the issue-usage overview, and
shareable list pagination SHALL be represented in the URL rather than display-only state.

#### Scenario: Application opens at the root

- **WHEN** a user opens the dashboard root
- **THEN** the application SHALL present or redirect to the issue-usage overview without requiring a backend mutation

#### Scenario: User opens an issue route directly

- **WHEN** a user loads a bookmarked issue-detail URL containing a stable Linear issue ID
- **THEN** the dashboard SHALL request and display that issue directly without first navigating through the overview

#### Scenario: User changes a list page

- **WHEN** a user moves to another issue or session page
- **THEN** the URL SHALL record the pagination state and browser back or forward navigation SHALL restore the corresponding page

### Requirement: Issue-usage overview

The issue-usage overview SHALL present the deterministic page returned by the backend. Every issue
row SHALL identify the Linear issue and show distinct session count, developer turns, input,
cached-input, output, and total tokens, estimated USD cost, and visible completeness or anomaly
state. The issue identifier SHALL navigate to local detail, while the Linear URL SHALL remain an
explicit external destination.

#### Scenario: Usage-bearing issues are available

- **WHEN** the issue-usage request succeeds with one or more items
- **THEN** the dashboard SHALL render the returned issues and metrics without recomputing accounting totals in the browser

#### Scenario: No issue has linked usage

- **WHEN** the issue-usage request succeeds with an empty page and total zero
- **THEN** the dashboard SHALL show an empty state explaining that imported sessions need valid Linear attribution and provide navigation to the session view

#### Scenario: Issue metrics are incomplete or anomalous

- **WHEN** an issue summary reports incomplete tokens, incomplete cost, anomaly codes, or pricing gaps
- **THEN** the dashboard SHALL distinguish the estimate from a complete result and expose the sanitized warning state without hiding known values

### Requirement: Issue usage detail

The issue-detail view SHALL display the issue summary, latest completed cost-generation identity
when present, contributing sessions, model breakdown, and UTC-daily breakdown returned by the
backend. It SHALL preserve the distinction between zero and unavailable metrics, label the null
date as unknown time, and explain that daily distinct-session counts are non-additive.

#### Scenario: Complete issue detail is returned

- **WHEN** the selected issue has currently linked sessions
- **THEN** the dashboard SHALL show its aggregate metrics and the returned session, model, and daily collections in deterministic order

#### Scenario: Session contains phase metadata

- **WHEN** an issue-detail session includes a phase
- **THEN** the dashboard SHALL display the phase as session metadata without presenting a phase aggregate that the backend did not provide

#### Scenario: Unknown model or time is returned

- **WHEN** the detail contains an `unknown` model bucket or a null daily date
- **THEN** the dashboard SHALL label the bucket explicitly rather than omitting it or assigning a guessed model or date

#### Scenario: Issue no longer has current usage

- **WHEN** a bookmarked issue-detail request returns the documented not-found response
- **THEN** the dashboard SHALL show a contextual not-found state with navigation back to the issue overview

### Requirement: Session attribution view

The session view SHALL present imported sessions with stable session ID, current title, usage and
import state, current title candidate, phase, committed Linear issue when present, synchronization
state, and sanitized failure information. A candidate and a committed issue SHALL remain visually
distinct when they differ.

#### Scenario: Session is unlinked

- **WHEN** a session has no committed issue
- **THEN** the dashboard SHALL identify it as unlinked and show any current candidate and phase supplied by the backend

#### Scenario: Linked session title contains a different candidate

- **WHEN** a session reports `relinkRequired: true`
- **THEN** the dashboard SHALL show the committed issue and replacement candidate separately and SHALL NOT imply that usage has already moved

#### Scenario: Attribution resolution failed

- **WHEN** a session reports `not_found` or `error`
- **THEN** the dashboard SHALL show a sanitized, actionable status without exposing credentials, raw Linear responses, or session message content

### Requirement: Explicit relink interaction

The dashboard SHALL expose relinking only for a session with a valid current candidate and SHALL
use the existing session relink operation without accepting an arbitrary issue identifier. A
replacement of a different committed issue SHALL require an explicit confirmation that identifies
both the current issue and candidate.

#### Scenario: User links an unlinked candidate

- **WHEN** a user explicitly applies the valid candidate of an unlinked session and the operation succeeds
- **THEN** the dashboard SHALL show the returned committed attribution and refresh affected session and issue-usage data

#### Scenario: User confirms a replacement candidate

- **WHEN** a linked session has a different candidate and the user confirms the relink
- **THEN** the dashboard SHALL invoke the relink operation exactly once and indicate progress until it finishes

#### Scenario: Relink fails

- **WHEN** the relink operation returns a validation, stale-title, Linear, or availability error
- **THEN** the dashboard SHALL preserve the displayed committed issue, show the sanitized failure, and allow a later retry when appropriate

#### Scenario: Relink is unavailable

- **WHEN** a session has no valid candidate, Linear is unconfigured, or attribution is not accepting work
- **THEN** the dashboard SHALL not offer an enabled relink action and SHALL explain the applicable prerequisite

### Requirement: Operational status and actions

The application shell SHALL surface import, Linear synchronization, and cost-calculation state and
SHALL provide the existing manual rescan, synchronization, and recalculation actions. Actions SHALL
reflect unconfigured, active, queued, stale, failed, and unavailable states without inventing a
successful outcome.

#### Scenario: All subsystems are current

- **WHEN** import roots are available, Linear is configured and idle, and cost coverage is current
- **THEN** the shell SHALL present a healthy operational summary without requiring the user to inspect raw status payloads

#### Scenario: A subsystem needs attention

- **WHEN** an import root is unavailable, a run has errors, Linear is unconfigured or failed, or cost coverage is stale or missing
- **THEN** the shell SHALL identify the affected subsystem and expose only sanitized details returned by the API

#### Scenario: User starts an operation

- **WHEN** a user invokes rescan, synchronization, or cost recalculation
- **THEN** the dashboard SHALL prevent accidental duplicate submission while pending, show the accepted queued or running state, and refresh relevant status and usage data

#### Scenario: Operation request fails

- **WHEN** an operational mutation fails
- **THEN** the dashboard SHALL retain the prior displayed data, report the failure, and provide retry where the backend state permits

### Requirement: Honest metric formatting

The dashboard SHALL format decimal-string counts and USD estimates for human reading without
silently losing integer precision or converting unavailable values to zero. Cached input SHALL be
shown as a subset of input rather than added to total tokens a second time.

#### Scenario: Count exceeds JavaScript safe integer range

- **WHEN** a count returned as a decimal string exceeds the safe integer range
- **THEN** the dashboard SHALL preserve its exact value while applying display grouping

#### Scenario: Metric is unavailable

- **WHEN** a token category or estimated cost is null
- **THEN** the dashboard SHALL render an unavailable marker and the applicable completeness state rather than `0`

#### Scenario: Cached input is displayed

- **WHEN** input and cached-input token values are available
- **THEN** the dashboard SHALL label cached input separately and SHALL display the backend total without adding cached input again

### Requirement: Loading, refresh, and failure behavior

Every server-backed dashboard view SHALL distinguish initial loading, background refresh, empty
success, and request failure. A failed refresh SHALL not masquerade as empty data, and recoverable
requests SHALL provide a retry action.

#### Scenario: View is loading for the first time

- **WHEN** a route has no cached result and its request is in progress
- **THEN** the dashboard SHALL show a route-appropriate loading state without briefly rendering an empty result

#### Scenario: Cached data is refreshing

- **WHEN** a route already has data and a refresh begins
- **THEN** the dashboard SHALL keep the prior data visible and indicate that it may be updating

#### Scenario: Request fails

- **WHEN** a list, detail, or status request fails
- **THEN** the dashboard SHALL show a bounded error state with retry and SHALL not expose an opaque stack trace or raw response body

### Requirement: Accessible and responsive presentation

The dashboard SHALL remain usable with keyboard navigation and common assistive technology and
SHALL adapt its navigation, metrics, tables, dialogs, and status presentation to narrow and wide
viewports without hiding required information.

#### Scenario: User navigates by keyboard

- **WHEN** a user traverses navigation, pagination, external links, actions, and confirmation controls with a keyboard
- **THEN** focus order and visible focus state SHALL follow the logical reading and interaction order

#### Scenario: Status changes asynchronously

- **WHEN** an operation enters a queued, running, succeeded, or failed state
- **THEN** the dashboard SHALL expose the meaningful status change through accessible text and an appropriate live region where necessary

#### Scenario: Dashboard is viewed on a narrow screen

- **WHEN** the viewport cannot fit the desktop table layout
- **THEN** required identities, metrics, warnings, navigation, and actions SHALL remain available through a readable responsive presentation

### Requirement: Frontend data and privacy boundaries

The dashboard SHALL obtain server data only through the generated API boundary and SHALL not read
Codex session files, DuckDB, or Linear directly. It SHALL not render or request message
transcripts, reasoning, tool arguments or results, credentials, or raw source records.

#### Scenario: Dashboard renders session information

- **WHEN** a session list or issue detail is displayed
- **THEN** the dashboard SHALL use normalized metadata, accounting, attribution, and sanitized diagnostic fields from the API without exposing stored message content

#### Scenario: Local display preference changes

- **WHEN** a user changes a display-only preference such as compact density
- **THEN** the preference MAY be stored locally but SHALL not copy or replace server-owned issue, session, usage, or operational state
