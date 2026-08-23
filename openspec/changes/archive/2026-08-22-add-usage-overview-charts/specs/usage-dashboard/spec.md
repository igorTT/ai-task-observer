## MODIFIED Requirements

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

## ADDED Requirements

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
