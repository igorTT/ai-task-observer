## ADDED Requirements

### Requirement: All-phase estimated-cost comparison

Every recent-usage response SHALL include an authoritative all-phase estimated-cost total and one
comparison entry for each canonical current session phase plus Unassigned. The comparison SHALL be
calculated from the same selected range, captured end instant, committed facts, and latest completed
cost generation as the requested timeline, but SHALL remain independent of the optional
current-session-phase filter applied to the response totals and hourly buckets.

#### Scenario: Apply phase is selected

- **WHEN** a client requests recent usage filtered to current session phase `apply`
- **THEN** response totals and buckets SHALL contain only Apply usage while the comparison SHALL contain the authoritative all-phase total and entries for every phase population

#### Scenario: All phases are selected

- **WHEN** a client requests recent usage without a session-phase filter
- **THEN** the comparison total SHALL describe the same all-phase known-time fact population as the response total

#### Scenario: Phase has no usage in the range

- **WHEN** one comparison phase has no committed observation with a known timestamp in the selected range
- **THEN** its deterministic comparison entry SHALL report zero estimated cost with complete empty-population state

#### Scenario: Phase assignment differs from title text

- **WHEN** a session title contains phase-like text that differs from its current explicit assignment
- **THEN** every known-time observation of that session SHALL contribute only to the entry for its current explicit assignment

#### Scenario: Explicit Other and Unassigned contribute

- **WHEN** explicitly Other sessions and sessions without an explicit phase both have usage in the selected range
- **THEN** their estimated costs SHALL contribute to distinct `other` and `unassigned` entries and each observation SHALL contribute to exactly one comparison entry

#### Scenario: Session is reassigned

- **WHEN** a session is explicitly reassigned from `proposal` to `apply`
- **THEN** all of its known-time usage in the requested range SHALL move from the Proposal comparison entry to the Apply entry without changing the authoritative all-phase total

### Requirement: Exact and complete phase comparison metrics

The all-phase total and every comparison entry SHALL return estimated USD cost as a decimal string
or null, SHALL expose cost completeness and sanitized warning state, and SHALL preserve known
partial estimates. Comparison entries SHALL use a stable documented order and SHALL NOT require a
client to sum phase entries to recover the authoritative all-phase total.

#### Scenario: Comparison cost is complete

- **WHEN** every contributing observation is completely represented by the selected cost generation
- **THEN** the all-phase total and each entry SHALL report exact estimated-cost values with complete state

#### Scenario: Selected cost matches its comparison entry

- **WHEN** a client requests one current session phase
- **THEN** the response total's estimated cost and cost completeness SHALL equal the matching phase comparison entry

#### Scenario: Comparison cost is partially available

- **WHEN** the latest generation provides some known estimated cost but does not completely cover the all-phase population or one phase population
- **THEN** the applicable total and entries SHALL preserve their known estimates, mark them partial, and expose sanitized warning codes

#### Scenario: Comparison cost is unavailable

- **WHEN** observations contribute to the range but no estimated cost is available for them
- **THEN** the applicable comparison amount SHALL be null with unavailable state rather than zero

#### Scenario: Unknown-time observation exists

- **WHEN** a session has a committed observation without a valid source timestamp
- **THEN** that observation SHALL NOT contribute to the range-bound comparison or be assigned a synthetic comparison time
