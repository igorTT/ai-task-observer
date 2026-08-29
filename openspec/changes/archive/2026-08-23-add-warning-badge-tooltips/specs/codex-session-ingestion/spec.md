## MODIFIED Requirements

### Requirement: Session page reflects returned cost state

The session page SHALL render the estimated cost returned by the session detail response, SHALL
show an explained warning badge when cost is partial or unavailable, and SHALL NOT show a positive
cost-complete badge when cost data is complete.

#### Scenario: Complete session estimate is displayed

- **WHEN** session detail returns a non-null estimate with `costComplete: true`
- **THEN** the page SHALL display the returned estimate without a partial, unavailable, or
  cost-complete badge

#### Scenario: Partial session estimate is displayed

- **WHEN** session detail returns a known estimate with `costComplete: false`
- **THEN** the page SHALL display the returned known estimate, identify it as partial, display its
  pricing-gap indicators, and provide an accessible explanation for each warning badge

#### Scenario: Unavailable session estimate is displayed

- **WHEN** session detail returns `estimatedCostUsd: null` with `costComplete: false`
- **THEN** the page SHALL present cost as unavailable rather than displaying a numeric zero and
  SHALL provide an accessible explanation on its unavailable-cost warning badge

