# issue-usage-aggregation Specification

## Purpose

Exposes trustworthy session and Linear-issue usage summaries from current attribution, normalized
events, and completed cost calculations without hiding incomplete or anomalous accounting.

## Requirements

### Requirement: Shared usage metric semantics

Every session, issue, date, and model summary SHALL use developer turns from canonical user-message
events; input tokens inclusive of cached input; cached input as its subset; total tokens as input
plus output; and `estimatedCostUsd` from the latest completed cost generation. Count and USD values
SHALL be represented as decimal strings at the HTTP boundary.

#### Scenario: Complete metrics are aggregated

- **WHEN** all contributing facts are valid and priced
- **THEN** the summary SHALL return summed turns, token categories, total tokens, estimated cost, and true completeness flags

#### Scenario: Cached input is included

- **WHEN** a summary contains cached input
- **THEN** cached input SHALL be reported separately but SHALL NOT be added again when deriving total tokens

### Requirement: Current-link issue attribution

The system SHALL attribute all facts from a session to its current committed Linear issue link.
Uncommitted title candidates SHALL have no effect on aggregation, and a successful explicit relink
SHALL move the entire session history to the replacement link.

#### Scenario: Linked title is renamed to another candidate

- **WHEN** a linked session title produces a different uncommitted candidate
- **THEN** all session usage SHALL remain with the current committed issue

#### Scenario: Relink succeeds

- **WHEN** an explicit relink atomically replaces the session's committed issue
- **THEN** subsequent queries SHALL include the full session history only under the new issue

#### Scenario: Relink fails

- **WHEN** an explicit relink fails and the prior committed link is preserved
- **THEN** aggregation SHALL remain unchanged

### Requirement: Usage-bearing issue population

Issue-usage queries SHALL include only cached Linear issues having at least one currently linked
session and SHALL exclude unlinked sessions and cached issues with no current session links.

#### Scenario: Cached issue has no linked sessions

- **WHEN** a cached Linear issue is not the current link of any session
- **THEN** it SHALL not appear in the issue-usage list

#### Scenario: Last session moves away

- **WHEN** the final linked session is successfully relinked to another issue
- **THEN** the former issue SHALL disappear from issue-usage results

### Requirement: Session and model breakdowns

An issue detail SHALL include each currently linked session's metadata, optional free-form phase,
usage metrics, and per-model breakdown. Model breakdown SHALL use canonical model identity when
resolved and `unknown` otherwise; phase SHALL NOT be a grouping dimension in this change.

#### Scenario: Session uses multiple models

- **WHEN** a linked session contains normalized usage for multiple models
- **THEN** its detail SHALL report the session total and one breakdown entry per canonical or unknown model bucket

#### Scenario: Session has phase metadata

- **WHEN** a linked session title contains a free-form phase suffix
- **THEN** the session detail SHALL return that metadata without creating a phase aggregate

### Requirement: UTC daily aggregation

Issue detail SHALL provide UTC calendar-day buckets plus an `unknown` bucket. Developer turns SHALL
be assigned by canonical user-message timestamp; token deltas and their cost components SHALL be
assigned by token-observation timestamp. No fallback timestamp SHALL be synthesized.

#### Scenario: Turn and usage occur on different UTC dates

- **WHEN** a user message and its later token observation fall on different UTC dates
- **THEN** the turn SHALL count on the message date and tokens and cost SHALL count on the observation date

#### Scenario: Timestamp is unknown

- **WHEN** a contributing event lacks a valid source timestamp
- **THEN** its applicable metrics SHALL appear in the `unknown` daily bucket

#### Scenario: Session spans multiple dates

- **WHEN** one session has activity on multiple UTC dates
- **THEN** it SHALL count once in each active daily bucket and once in the all-time issue session count

### Requirement: Distinct non-additive session counts

The all-time issue session count SHALL equal distinct currently linked sessions. Each daily session
count SHALL equal distinct linked sessions with any assigned turn or usage activity in that bucket,
and daily session counts SHALL be documented as non-additive across buckets.

#### Scenario: Session has several events on one day

- **WHEN** one session contributes multiple turns or token observations to one UTC day
- **THEN** that day SHALL count the session exactly once

#### Scenario: Daily counts are summed by a client

- **WHEN** a session appears in more than one daily bucket
- **THEN** the API contract SHALL make clear that summed daily session counts can exceed the all-time distinct count

### Requirement: Completeness and anomaly propagation

Summaries SHALL expose separate token and cost completeness plus anomaly codes or counts. If any
contributing fact makes a token category unknown, that aggregate category SHALL be null. Known cost
components MAY sum to a partial `estimatedCostUsd`, but `costComplete` SHALL be false; it SHALL be
null when no cost component is known.

#### Scenario: One session has incomplete cached input

- **WHEN** an issue includes a session whose cached-input category is unknown
- **THEN** issue cached input SHALL be null, token completeness SHALL be false, and independently complete categories MAY remain available

#### Scenario: One model is unpriced

- **WHEN** an issue includes priced usage and usage whose model or period is unpriced
- **THEN** the issue SHALL return the known partial estimate with `costComplete: false` and expose the pricing gap

#### Scenario: No completed cost generation exists

- **WHEN** usage exists but no completed calculation generation is queryable
- **THEN** `estimatedCostUsd` SHALL be null and `costComplete` SHALL be false without blocking token aggregation

### Requirement: Issue-usage HTTP resources

The backend SHALL expose generated-contract operations to list issue-usage summaries and retrieve
one issue-usage detail by stable Linear issue ID. Responses SHALL contain issue display metadata,
usage metrics and completeness; detail SHALL additionally contain session, model, and daily
breakdowns. Controllers SHALL not trigger Linear mutation or pricing recalculation.

#### Scenario: Issue usage list is requested

- **WHEN** a client requests a bounded page of issue-usage summaries
- **THEN** the backend SHALL return deterministic pagination over usage-bearing issues with stable IDs, identifiers, titles, URLs, summary metrics, completeness, and anomaly state

#### Scenario: Issue usage detail is requested

- **WHEN** a client requests the stable ID of a usage-bearing issue
- **THEN** the backend SHALL return its summary plus session, model, UTC-daily, and unknown-time breakdowns from committed facts

#### Scenario: Issue has no current usage

- **WHEN** a client requests a cached issue that has no currently linked sessions or an unknown issue ID
- **THEN** the backend SHALL return the documented not-found response

#### Scenario: Partial import is visible

- **WHEN** a linked session is importing or has a failed pending rebuild while prior facts remain committed
- **THEN** queries SHALL use only committed facts and SHALL expose the session's import/accounting state without reading partial writes

