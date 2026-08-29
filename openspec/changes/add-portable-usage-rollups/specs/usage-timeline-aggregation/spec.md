## MODIFIED Requirements

### Requirement: Supported rolling usage ranges

The system SHALL expose recent usage for the fixed `12h` and `24h` ranges and a long-range `90d`
range. A request without a range SHALL use `12h`; each response SHALL capture one end instant and
define a half-open interval beginning exactly twelve hours, twenty-four hours, or ninety calendar
days before that instant according to the requested range.

#### Scenario: Range is omitted

- **WHEN** a client requests recent usage without a range
- **THEN** the system SHALL return the `12h` range and identify its exact start and end instants

#### Scenario: Twenty-four-hour range is requested

- **WHEN** a client requests the supported `24h` range
- **THEN** the system SHALL return facts whose known observation timestamps fall within the
  half-open interval `[end minus 24 hours, end)`

#### Scenario: Ninety-day range is requested

- **WHEN** a client requests the supported `90d` range
- **THEN** the system SHALL return facts whose known observation timestamps fall within the
  half-open interval `[end minus 90 calendar days, end)` and SHALL identify the daily bucket unit

#### Scenario: Range is unsupported

- **WHEN** a client requests a value other than `12h`, `24h`, or `90d`
- **THEN** the system SHALL reject the request with the documented validation response rather than
  selecting an arbitrary duration

### Requirement: Deterministic hourly timeline buckets

The system SHALL return contiguous ordered buckets covering the selected range. For `12h` and
`24h`, interior bucket boundaries SHALL align to UTC clock hours. For `90d`, buckets SHALL align to
UTC calendar days. The first and last buckets MAY be partial, and every bucket SHALL contain only
observations whose timestamps fall within its half-open interval.

#### Scenario: Range crosses clock-hour boundaries

- **WHEN** a selected `12h` or `24h` range starts or ends between UTC clock-hour boundaries
- **THEN** the response SHALL include clipped first and last hourly buckets plus every complete
  intervening hourly bucket without overlap or gaps

#### Scenario: One hour has no observations

- **WHEN** no committed observation falls within an hourly bucket
- **THEN** the system SHALL return that hourly bucket with zero token and cost values so the
  timeline remains continuous

#### Scenario: Ninety-day range crosses calendar boundaries

- **WHEN** a selected `90d` range starts or ends between UTC calendar-day boundaries
- **THEN** the response SHALL include clipped first and last daily buckets plus every complete
  intervening daily bucket without overlap or gaps

#### Scenario: One interval has no observations

- **WHEN** no committed observation falls within an hourly or daily bucket
- **THEN** the system SHALL return that bucket with zero token and cost values so the timeline
  remains continuous

#### Scenario: Observation lies on a boundary

- **WHEN** an observation timestamp exactly equals a bucket boundary
- **THEN** the system SHALL assign it to the bucket beginning at that boundary and SHALL not count
  it in the preceding bucket

### Requirement: Exact token and configured cost metrics

The response SHALL calculate total tokens from committed normalized observations and configured
API-equivalent estimated cost from the latest completed cost generation, whether the result is
served from source facts or equivalent derived summaries. It SHALL return count and USD values as
decimal strings and SHALL calculate selected-range totals from the same committed population and
cutoff used for the buckets.

#### Scenario: Complete observations are available

- **WHEN** every contributing observation has complete normalized total tokens and a complete item
  in the latest completed cost generation
- **THEN** the response SHALL return exact token and estimated-cost totals, matching the selected
  buckets, and true completeness

#### Scenario: Cost calculation is unavailable

- **WHEN** contributing token observations exist but no completed cost generation exists
- **THEN** token totals and buckets SHALL remain available while estimated cost is unavailable and
  cost completeness is false

#### Scenario: Cost is partially priceable

- **WHEN** the latest generation contains known cost components and one or more incomplete or
  uncovered observations in the selected range
- **THEN** the response SHALL preserve the known partial cost, mark cost completeness false, and
  expose sanitized pricing-gap state

#### Scenario: Token total is incomplete

- **WHEN** any contributing observation lacks a normalized total-token value
- **THEN** the affected bucket and selected-range token total SHALL be unavailable and token
  completeness SHALL be false rather than presenting a known-partial count as complete

#### Scenario: Selected range has no observations

- **WHEN** no committed observation with a known timestamp falls within the selected range
- **THEN** totals and all buckets SHALL report zero tokens and zero estimated cost with complete
  empty-range state

### Requirement: Recent usage HTTP resource

The backend SHALL expose the recent usage timeline through the generated HTTP contract without
triggering import, attribution, synchronization, or cost-recalculation mutations. The contract
SHALL identify whether the returned buckets are hourly or daily.

#### Scenario: Long-range timeline is requested

- **WHEN** a client requests `90d`
- **THEN** the generated contract SHALL return the `90d` range, `day` bucket unit, exact start and
  end instants, backend totals, ordered daily buckets, completeness, sanitized warning state, and
  cost-generation provenance

#### Scenario: Existing short-range timeline is requested

- **WHEN** a client requests `12h` or `24h`
- **THEN** the generated contract SHALL preserve the existing hourly response shape and metric
  semantics

#### Scenario: Timeline query fails

- **WHEN** committed usage, derived summaries, or generation data cannot be queried
- **THEN** the endpoint SHALL return a sanitized failure response without exposing source paths,
  raw records, credentials, message content, reasoning, or tool data

#### Scenario: Timeline is requested

- **WHEN** a client requests a supported usage range
- **THEN** the generated contract SHALL return the range, bucket unit, start and end instants,
  backend totals, ordered buckets, completeness, sanitized warning state, and cost-generation
  provenance

## ADDED Requirements

### Requirement: Current session-phase filtering

The timeline SHALL accept an optional current session-phase filter. When omitted or set to `all`
by the client, it SHALL include every committed observation. When set to `unassigned`, it SHALL
include only observations belonging to sessions without an explicit phase. When set to a canonical
phase, it SHALL include only observations belonging to sessions explicitly assigned that phase.

#### Scenario: All phases are requested

- **WHEN** a client requests the timeline without a phase filter
- **THEN** the response SHALL include observations from every session and identify no selected phase

#### Scenario: Unassigned phase is requested

- **WHEN** a client requests `unassigned`
- **THEN** the response SHALL exclude every session with an explicit phase and SHALL return zero
  when no unassigned session has usage in the selected range

#### Scenario: Canonical phase is requested

- **WHEN** a client requests a canonical phase such as `apply`
- **THEN** the response SHALL include only sessions currently assigned that phase and SHALL return
  zero when no matching session has usage in the selected range
