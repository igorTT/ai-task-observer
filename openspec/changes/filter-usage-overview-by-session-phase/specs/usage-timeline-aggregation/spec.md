## ADDED Requirements

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
