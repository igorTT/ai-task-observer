# Usage Timeline Aggregation Specification

## Purpose

Provides trustworthy rolling-range token and configured cost totals plus time buckets across all
committed imported Codex usage, independently of Linear attribution.

## Requirements

### Requirement: Supported rolling usage ranges

The system SHALL expose recent usage for the fixed `12h` and `24h` ranges. A request without a
range SHALL use `12h`; each response SHALL capture one end instant and define a half-open interval
beginning exactly twelve or twenty-four hours before that instant.

#### Scenario: Range is omitted

- **WHEN** a client requests recent usage without a range
- **THEN** the system SHALL return the `12h` range and identify its exact start and end instants

#### Scenario: Twenty-four-hour range is requested

- **WHEN** a client requests the supported `24h` range
- **THEN** the system SHALL return facts whose known observation timestamps fall within the half-open interval `[end minus 24 hours, end)`

#### Scenario: Range is unsupported

- **WHEN** a client requests a value other than `12h` or `24h`
- **THEN** the system SHALL reject the request with the documented validation response rather than selecting an arbitrary duration

### Requirement: Deterministic hourly timeline buckets

The system SHALL return contiguous ordered buckets covering the selected range. Interior bucket
boundaries SHALL align to UTC clock hours, the first and last buckets MAY be partial, and a bucket
SHALL contain only observations whose timestamps fall within its half-open interval.

#### Scenario: Range crosses clock-hour boundaries

- **WHEN** the selected range starts or ends between UTC clock-hour boundaries
- **THEN** the response SHALL include clipped first and last buckets plus every complete intervening hourly bucket without overlap or gaps

#### Scenario: One hour has no observations

- **WHEN** no committed observation falls within an hourly bucket
- **THEN** the system SHALL return that bucket with zero token and cost values so the timeline remains continuous

#### Scenario: Observation lies on a boundary

- **WHEN** an observation timestamp exactly equals a bucket boundary
- **THEN** the system SHALL assign it to the bucket beginning at that boundary and SHALL not count it in the preceding bucket

### Requirement: Global imported-usage population

Recent usage SHALL include every committed normalized Codex usage observation with a known source
timestamp in the selected range, regardless of whether its session is linked, unlinked,
unresolved, or awaiting Linear synchronization. Attribution state SHALL NOT change global timeline
membership.

#### Scenario: Unlinked session contributes usage

- **WHEN** an unlinked imported session has a committed observation in the selected range
- **THEN** its tokens and any latest-generation cost SHALL contribute to the same timeline as usage from linked sessions

#### Scenario: Session is relinked

- **WHEN** a session's committed Linear attribution changes without changing its usage facts
- **THEN** the global timeline totals and buckets SHALL remain unchanged

#### Scenario: Observation time is unknown

- **WHEN** a committed usage observation has no valid source timestamp
- **THEN** the system SHALL exclude it from range totals and buckets, SHALL NOT synthesize a timestamp, and SHALL report it separately as unknown-time usage

### Requirement: Exact token and configured cost metrics

The response SHALL calculate total tokens from committed normalized observations and configured
API-equivalent estimated cost from the latest completed cost generation. It SHALL return count and
USD values as decimal strings and SHALL calculate selected-range totals on the backend from the
same facts and cutoff used for the buckets.

#### Scenario: Complete observations are available

- **WHEN** every contributing observation has complete normalized total tokens and a complete item in the latest completed cost generation
- **THEN** the response SHALL return exact token and estimated-cost totals, matching hourly buckets, and true completeness

#### Scenario: Cost calculation is unavailable

- **WHEN** contributing token observations exist but no completed cost generation exists
- **THEN** token totals and buckets SHALL remain available while estimated cost is unavailable and cost completeness is false

#### Scenario: Cost is partially priceable

- **WHEN** the latest completed generation contains known cost components and one or more incomplete or uncovered observations in the selected range
- **THEN** the response SHALL preserve the known partial cost, mark cost completeness false, and expose sanitized pricing-gap state

#### Scenario: Token total is incomplete

- **WHEN** any contributing observation lacks a normalized total-token value
- **THEN** the affected bucket and selected-range token total SHALL be unavailable and token completeness SHALL be false rather than presenting a known-partial count as complete

#### Scenario: Selected range has no observations

- **WHEN** no committed observation with a known timestamp falls within the selected range
- **THEN** totals and all buckets SHALL report zero tokens and zero estimated cost with complete empty-range state

### Requirement: Cost generation provenance and coverage

Every response SHALL identify the latest completed cost generation when one exists and SHALL
distinguish current, stale, and missing generation coverage. Range-specific cost completeness SHALL
also account for each selected observation's presence and completeness in that generation.

#### Scenario: Latest generation is current

- **WHEN** the latest completed generation matches the current usage revision, pricing catalog, and calculator
- **THEN** the response SHALL report current coverage and its generation identity

#### Scenario: Latest generation is stale

- **WHEN** the latest completed generation does not match the current usage revision, pricing catalog, or calculator
- **THEN** the response SHALL report stale coverage and SHALL mark selected observations absent from that generation as incomplete

#### Scenario: No generation exists

- **WHEN** no completed generation is queryable
- **THEN** the response SHALL report missing coverage and a null generation identity

### Requirement: Recent usage HTTP resource

The backend SHALL expose the recent usage timeline through the generated HTTP contract without
triggering import, attribution, synchronization, or cost-recalculation mutations.

#### Scenario: Timeline is requested

- **WHEN** a client requests a supported recent usage range
- **THEN** the generated contract SHALL return the range, bucket unit, start and end instants, backend totals, ordered buckets, completeness, sanitized warning state, and cost-generation provenance

#### Scenario: Timeline query fails

- **WHEN** committed usage or generation data cannot be queried
- **THEN** the endpoint SHALL return a sanitized failure response without exposing source paths, raw records, credentials, message content, reasoning, or tool data
