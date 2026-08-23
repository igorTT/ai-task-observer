## ADDED Requirements

### Requirement: Session responses expose calculated cost state

Session list and detail responses SHALL expose `estimatedCostUsd`, `costComplete`, and
`pricingGapCodes` for each session using only usage observations covered by the latest completed
cost-calculation generation. USD values SHALL use decimal strings, and the response SHALL preserve
the established distinction between complete, partial, and unavailable API-equivalent estimates.

#### Scenario: Session cost is complete

- **WHEN** every usage observation for a session is covered by the latest completed generation and
  every covered observation is completely priceable
- **THEN** session list and detail responses SHALL return the summed estimate, `costComplete: true`,
  and no pricing-gap codes

#### Scenario: Session cost is partial

- **WHEN** at least one session observation contributes a known cost and at least one contributing
  observation is unpriced, incompletely priced, or not covered by the latest completed generation
- **THEN** session list and detail responses SHALL return only the known estimate with
  `costComplete: false` and SHALL expose applicable pricing-gap codes

#### Scenario: Session cost is unavailable

- **WHEN** no session observation has a priceable component in the latest completed generation
- **THEN** session list and detail responses SHALL return `estimatedCostUsd: null` and
  `costComplete: false` without blocking normalized token fields

#### Scenario: No completed cost generation exists

- **WHEN** a session has normalized usage but no completed cost-calculation generation is queryable
- **THEN** its responses SHALL return `estimatedCostUsd: null`, `costComplete: false`, and a
  `pricingGapCodes` entry of `uncovered_generation` without failing the session request

### Requirement: Session page reflects returned cost state

The session page SHALL render the estimated cost and cost completeness state returned by the
session detail response and SHALL NOT synthesize a permanently partial state when cost data is
complete.

#### Scenario: Complete session estimate is displayed

- **WHEN** session detail returns a non-null estimate with `costComplete: true`
- **THEN** the page SHALL display the returned estimate, identify the cost as complete, and SHALL
  NOT label it as partial

#### Scenario: Partial session estimate is displayed

- **WHEN** session detail returns a known estimate with `costComplete: false`
- **THEN** the page SHALL display the returned known estimate, identify it as partial, and display
  its pricing-gap indicators

#### Scenario: Unavailable session estimate is displayed

- **WHEN** session detail returns `estimatedCostUsd: null` with `costComplete: false`
- **THEN** the page SHALL present cost as unavailable rather than displaying a numeric zero
