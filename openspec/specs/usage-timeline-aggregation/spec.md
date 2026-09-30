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

### Requirement: Current session phase filtering

The system SHALL optionally constrain recent usage to sessions whose current explicit phase
assignment matches one requested canonical phase or to sessions that are currently unassigned. A
request without a session-phase filter SHALL retain the global imported-usage population. Phase
membership SHALL come only from explicit phase assignment and SHALL remain independent of session
title text and Linear attribution state.

#### Scenario: Canonical phase is selected

- **WHEN** a client requests recent usage for current session phase `proposal`
- **THEN** totals, hourly buckets, completeness, warnings, and unknown-time observation count SHALL be calculated only from sessions currently assigned `proposal`

#### Scenario: Session phase is omitted

- **WHEN** a client requests recent usage without a session-phase filter
- **THEN** assigned and unassigned sessions SHALL contribute according to the existing global timeline rules

#### Scenario: Unassigned sessions are selected

- **WHEN** a client requests the reporting-only `unassigned` selection
- **THEN** only sessions with no explicit phase assignment SHALL contribute and sessions explicitly assigned `other` SHALL not contribute

#### Scenario: Other phase is selected

- **WHEN** a client requests current session phase `other`
- **THEN** only sessions explicitly assigned `other` SHALL contribute and unassigned sessions SHALL not contribute

#### Scenario: Title contains phase-like text

- **WHEN** a session title or title suffix contains `proposal` but the session is unassigned or assigned another phase
- **THEN** that text SHALL NOT make the session contribute to the `proposal` timeline

#### Scenario: Unlinked assigned session contributes

- **WHEN** an unlinked session is currently assigned the selected phase and has committed usage in the selected range
- **THEN** its usage SHALL contribute regardless of its Linear attribution or synchronization state

### Requirement: Current assignment reclassifies session usage

Phase-filtered usage SHALL classify every event of a session by that session's one current explicit
phase assignment. Replacing or clearing the assignment SHALL intentionally reclassify all of the
session's committed usage without rewriting observations or cost-calculation generations.

#### Scenario: Session is reassigned

- **WHEN** a session is explicitly reassigned from `proposal` to `apply`
- **THEN** all of its observations within a requested range SHALL stop contributing to `proposal` and SHALL contribute to `apply`

#### Scenario: Session contains mixed workflow activity

- **WHEN** one session contains activity from more than one real-world workflow stage
- **THEN** the system SHALL classify all of that session's activity by its one current explicit assignment and SHALL NOT infer per-event phases

#### Scenario: Assignment is cleared

- **WHEN** a session's explicit phase is cleared
- **THEN** all of its usage SHALL move to the unassigned population for subsequent queries

### Requirement: Session phase timeline HTTP contract

The generated recent-usage HTTP contract SHALL accept one optional current-session-phase filter
from the canonical phase vocabulary plus the reporting-only `unassigned` selection, SHALL echo the
effective selection, and SHALL reject unsupported values without triggering import,
attribution, synchronization, phase mutation, or cost recalculation.

#### Scenario: Supported filter is requested

- **WHEN** a client requests a supported canonical or unassigned session-phase selection
- **THEN** the generated contract SHALL return the effective selection with the correspondingly filtered timeline

#### Scenario: Unsupported filter is requested

- **WHEN** a client requests a session-phase value outside the documented filter vocabulary
- **THEN** the backend SHALL return the documented validation response without changing stored phase or usage data

#### Scenario: Filtered observation has unknown time

- **WHEN** a selected session has a committed observation without a valid source timestamp
- **THEN** the observation SHALL be excluded from totals and hourly buckets and included in the phase-filtered unknown-time observation count
