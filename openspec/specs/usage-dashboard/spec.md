# Usage Dashboard Specification

## Purpose

Provides a local, trustworthy interface for inspecting Codex usage by Linear issue, reviewing
session attribution, and operating the existing import, synchronization, and cost workflows.

## Requirements

### Requirement: Routed dashboard navigation

The dashboard SHALL provide stable routes for the recent-usage overview, issue-usage list, one
issue's usage detail, and the imported-session list. The root route SHALL lead to the recent-usage
overview, and shareable list pagination and non-default overview range SHALL be represented in the
URL rather than display-only state.

#### Scenario: Application opens at the root

- **WHEN** a user opens the dashboard root
- **THEN** the application SHALL present or redirect to the recent-usage overview without requiring a backend mutation

#### Scenario: User opens an issue route directly

- **WHEN** a user loads a bookmarked issue-detail URL containing a stable Linear issue ID
- **THEN** the dashboard SHALL request and display that issue directly without first navigating through the overview

#### Scenario: User changes a list page

- **WHEN** a user moves to another issue or session page
- **THEN** the URL SHALL record the pagination state and browser back or forward navigation SHALL restore the corresponding page

#### Scenario: User navigates among primary views

- **WHEN** a user uses primary navigation
- **THEN** the dashboard SHALL provide distinct destinations for Overview, Issues, and Sessions and SHALL identify the active destination

### Requirement: Recent usage range selection

The overview SHALL provide one shared segmented selector with `12 hours` and `24 hours` options.
The selected range SHALL control both counters and both charts. The initial and fallback selection
SHALL be `12 hours`; the non-default `24 hours` selection SHALL be represented in URL state.

#### Scenario: Overview opens without range state

- **WHEN** a user opens `/overview` without a range query value
- **THEN** the dashboard SHALL visibly select `12 hours` and request the `12h` timeline

#### Scenario: User selects twenty-four hours

- **WHEN** a user activates the `24 hours` option
- **THEN** the dashboard SHALL update the URL, request the `24h` timeline, and update both counters and charts together

#### Scenario: URL range is invalid

- **WHEN** the overview URL contains an absent, malformed, or unsupported range value
- **THEN** the dashboard SHALL normalize to the `12 hours` selection without issuing an unsupported API request

#### Scenario: Browser navigation restores range

- **WHEN** the user navigates backward or forward after changing the range
- **THEN** the selector, counters, and charts SHALL restore the range represented by the resulting URL

### Requirement: Selected-range usage counters

The overview SHALL display a total-token counter and a configured API-equivalent estimated-cost
counter for the selected range using totals supplied by the backend. Each counter SHALL identify
the selected duration and visibly distinguish complete, partial, unavailable, and zero values.

#### Scenario: Complete selected-range totals are returned

- **WHEN** the timeline response contains complete token and cost totals
- **THEN** the overview SHALL format and display those exact totals for the selected range without recomputing them from chart points

#### Scenario: Estimated cost is partial

- **WHEN** the timeline response contains a known partial estimated cost with false cost completeness
- **THEN** the overview SHALL display the known estimate with an explicit partial-state indicator rather than hiding it or presenting it as billed spend

#### Scenario: Metric is unavailable

- **WHEN** the backend returns an unavailable token or cost total
- **THEN** the applicable counter SHALL display an unavailable marker and warning state rather than zero

#### Scenario: Range has no usage

- **WHEN** the backend reports a complete selected range with zero usage
- **THEN** both counters SHALL display zero as a known result rather than an unavailable marker

### Requirement: Token and estimated-cost consumption charts

The overview SHALL render separate hourly bar charts for total-token consumption and configured
API-equivalent estimated-cost consumption using the ordered backend buckets. Both charts SHALL use
the same time domain, synchronize corresponding bucket inspection, and preserve the distinction
between zero, partial, and unavailable values.

#### Scenario: Hourly usage is available

- **WHEN** the selected timeline contains hourly buckets
- **THEN** the dashboard SHALL render one token bar and one estimated-cost bar per bucket in chronological order

#### Scenario: User inspects a bucket

- **WHEN** a user hovers or keyboard-focuses a bucket in either chart
- **THEN** both charts SHALL identify the corresponding interval and expose its client-local time range, exact metric value, and completeness state

#### Scenario: Bucket is incomplete

- **WHEN** a bucket has partial cost or unavailable tokens
- **THEN** the affected chart SHALL distinguish that state from complete consumption and SHALL expose an accessible textual explanation

#### Scenario: Bucket is empty

- **WHEN** a returned bucket contains known zero usage
- **THEN** both charts SHALL retain the bucket on the shared time axis without presenting it as missing data

### Requirement: Overview request states and accessibility

The overview SHALL distinguish initial loading, cached refresh, empty success, request failure,
and stale or missing cost coverage while keeping the selector and meaningful prior data available
when possible. Its counters, range selector, chart names, intervals, values, and warning states
SHALL be usable with keyboard navigation and common assistive technology at supported desktop
viewport widths.

#### Scenario: Overview loads initially

- **WHEN** no cached timeline exists and the selected-range request is pending
- **THEN** the dashboard SHALL show overview-appropriate counter and chart loading states without briefly claiming zero usage

#### Scenario: Selected range refreshes

- **WHEN** cached overview data exists and a refresh begins
- **THEN** the dashboard SHALL retain the prior counters and charts, indicate background refresh, and replace them only when the request succeeds

#### Scenario: Timeline request fails

- **WHEN** the selected-range request fails
- **THEN** the overview SHALL show a bounded sanitized error with retry and SHALL not present an empty chart as a successful result

#### Scenario: Cost generation is stale or missing

- **WHEN** the timeline reports stale or missing cost-generation coverage
- **THEN** the overview SHALL keep independently available token information visible and SHALL identify why cost information may be incomplete or unavailable

#### Scenario: Chart is operated without a pointer

- **WHEN** a keyboard or assistive-technology user reaches a consumption chart
- **THEN** the chart SHALL expose its purpose, selected range, ordered bucket intervals, exact values, and completeness state without requiring pointer-only interaction

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

The dashboard SHALL format token counts as compact decimal-string values for human reading without
using unsafe numeric conversion, converting unavailable values to zero, or overstating usage.
Token counts below one thousand SHALL remain exact. Larger token counts SHALL use lowercase `k`,
`m`, `b`, or `t` suffixes, with the `t` unit retained for values beyond its base range. The
dashboard SHALL retain one non-zero truncated decimal digit when the scaled whole value is below
100, SHALL omit a zero fractional digit, and SHALL omit the decimal digit when the scaled whole
value is 100 or greater. Non-token counts and USD estimates SHALL retain their existing formatting.
Cached input SHALL be shown as a subset of input rather than added to total tokens a second time.

#### Scenario: Token count is below the compact threshold

- **WHEN** a token count is between `0` and `999`
- **THEN** the dashboard SHALL display the exact decimal value without a magnitude suffix

#### Scenario: Token count has a scaled value below one hundred

- **WHEN** a token count scales below 100 in its selected magnitude, such as `1,700,000` or `12,700,000`
- **THEN** the dashboard SHALL display one truncated decimal digit, such as `1.7m` or `12.7m`

#### Scenario: Compact token count has no fractional remainder

- **WHEN** a token count scales to a whole value, such as `1,000,000`
- **THEN** the dashboard SHALL display `1m` without a trailing `.0`

#### Scenario: Token count has a scaled value of at least one hundred

- **WHEN** a token count scales to at least 100 in its selected magnitude, such as `990,673`
- **THEN** the dashboard SHALL omit the fractional part and display the truncated whole value, such as `990k`

#### Scenario: Compact token count approaches the next magnitude

- **WHEN** discarded digits would round the compact value into the next magnitude, such as `999,999`
- **THEN** the dashboard SHALL truncate the value to `999k` rather than round it to `1m`

#### Scenario: Count exceeds JavaScript safe integer range

- **WHEN** a token count returned as a decimal string exceeds the safe integer range
- **THEN** the dashboard SHALL derive its compact label without passing the count through an unsafe numeric representation

#### Scenario: Metric is unavailable

- **WHEN** a token category or estimated cost is null
- **THEN** the dashboard SHALL render an unavailable marker and the applicable completeness state rather than `0`

#### Scenario: Token metric is invalid

- **WHEN** a token value is not a valid non-negative decimal count
- **THEN** the dashboard SHALL render an unavailable marker rather than a misleading compact label

#### Scenario: Non-token count is displayed

- **WHEN** the dashboard displays a session count or developer-turn count
- **THEN** it SHALL retain the existing exact grouped-count presentation without a compact suffix

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

The dashboard SHALL remain usable with keyboard navigation and common assistive technology at
supported desktop viewport widths. The supported presentation range SHALL begin at 1024 CSS pixels,
and the dashboard SHALL keep required navigation, metrics, tables, dialogs, actions, and status
information available without page-level horizontal overflow throughout that range. Presentation
at narrower viewport widths is outside the supported product contract.

#### Scenario: User navigates by keyboard

- **WHEN** a user traverses navigation, pagination, external links, actions, and confirmation controls with a keyboard at a supported desktop viewport width
- **THEN** focus order and visible focus state SHALL follow the logical reading and interaction order

#### Scenario: Status changes asynchronously

- **WHEN** an operation enters a queued, running, succeeded, or failed state at a supported desktop viewport width
- **THEN** the dashboard SHALL expose the meaningful status change through accessible text and an appropriate live region where necessary

#### Scenario: Dashboard is viewed at the minimum supported width

- **WHEN** the dashboard is displayed in a viewport 1024 CSS pixels wide
- **THEN** required identities, metrics, warnings, navigation, dialogs, and actions SHALL remain available in the desktop presentation without page-level horizontal overflow

#### Scenario: Dashboard is viewed on a narrow screen

- **WHEN** the dashboard is displayed in a viewport narrower than 1024 CSS pixels
- **THEN** the dashboard SHALL retain its desktop presentation and SHALL NOT provide alternative narrow-screen navigation or table layouts

### Requirement: Frontend data and privacy boundaries

The dashboard SHALL obtain server data only through the generated API boundary and SHALL not read
Codex session files, DuckDB, or Linear directly. It SHALL not render or request message
transcripts, reasoning, tool arguments or results, credentials, or raw source records. The
dashboard SHALL use one fixed presentation density based on the former comfortable spacing and
SHALL not offer or retain a compact/comfortable density preference in client state.

#### Scenario: Dashboard renders session information

- **WHEN** a session list or issue detail is displayed
- **THEN** the dashboard SHALL use normalized metadata, accounting, attribution, and sanitized diagnostic fields from the API without exposing stored message content

#### Scenario: Local display preference changes

- **WHEN** a user views the dashboard or navigates between its routes
- **THEN** the dashboard SHALL retain one fixed presentation density and SHALL not expose a compact/comfortable density control

### Requirement: Client-zone timestamp presentation

The dashboard SHALL present timestamp instants in the client browser's current time zone while
preserving their represented instant. It SHALL continue to present UTC calendar-day aggregation
keys as UTC dates and SHALL distinguish unavailable or invalid timestamp values from valid times.

#### Scenario: Timestamp instant is displayed

- **WHEN** a dashboard view receives a valid timestamp instant from the API
- **THEN** the dashboard SHALL display the corresponding date and time in the client browser's current time zone

#### Scenario: Local date differs from UTC date

- **WHEN** converting a valid timestamp instant to the client browser's current time zone crosses a calendar-day boundary
- **THEN** the dashboard SHALL display the local calendar date and time rather than the UTC calendar date and time

#### Scenario: Timestamp is unavailable or invalid

- **WHEN** a timestamp field is absent, null, empty, or invalid
- **THEN** the dashboard SHALL display an unknown-time marker without inventing a date or time

#### Scenario: UTC daily usage bucket is displayed

- **WHEN** issue detail displays a daily-usage bucket identified by a UTC calendar date
- **THEN** the dashboard SHALL preserve the returned date and identify the breakdown as UTC rather than converting the bucket to the client time zone
