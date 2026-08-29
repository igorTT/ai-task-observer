## ADDED Requirements

### Requirement: Usage metric badges explain warning states

Usage metric state SHALL display badges only for incomplete token accounting, incomplete or
unavailable cost, anomaly codes, and pricing-gap codes. Each displayed warning badge SHALL provide
a concise sanitized explanation that is available to pointer and keyboard users without hiding
known metric values.

#### Scenario: Usage metrics are complete

- **WHEN** token and cost accounting are complete and no anomaly or pricing-gap codes are present
- **THEN** the dashboard SHALL display the metric values without token-complete or cost-complete
  success badges

#### Scenario: Usage metrics contain warnings

- **WHEN** token or cost accounting is incomplete or the response contains anomaly or pricing-gap
  codes
- **THEN** the dashboard SHALL display a warning badge for every applicable warning state while
  preserving all known metric values

#### Scenario: User requests a warning explanation

- **WHEN** a user hovers over or moves keyboard focus to a usage warning badge
- **THEN** the dashboard SHALL expose a concise explanation of what the warning means

#### Scenario: Warning code is not recognized by the client

- **WHEN** the backend returns a sanitized anomaly or pricing-gap code for which the client has no
  specific explanation
- **THEN** the dashboard SHALL retain a human-readable warning label and provide a generic
  sanitized explanation without exposing raw payloads

#### Scenario: Several warnings are present

- **WHEN** a metric summary contains more than one warning condition or code
- **THEN** each warning badge SHALL remain independently focusable and SHALL expose the explanation
  associated with that badge

