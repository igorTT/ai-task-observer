## ADDED Requirements

### Requirement: Recent model usage presentation

The overview SHALL present the backend-supplied selected-population model breakdown in a dynamic,
accessible table or card with Model, Total tokens, and Estimated cost columns. It SHALL visibly
identify canonical model buckets and label the reserved `unknown` bucket as Unknown model, preserve
exact values and completeness state, and update the breakdown from the same request as the existing
overview values.

#### Scenario: Several configured models have usage

- **WHEN** the timeline returns entries for Sol, Terra, and Luna
- **THEN** the overview SHALL render all three returned models and their exact token and estimated-cost values without relying on a fixed two-model layout

#### Scenario: Range changes

- **WHEN** the user changes between the 12-hour and 24-hour ranges
- **THEN** the counters, charts, model breakdown, warnings, and unknown-time notice SHALL update together from the resulting timeline response

#### Scenario: Current phase changes

- **WHEN** the user selects All, a canonical current session phase, or Unassigned
- **THEN** the model breakdown SHALL update to the same range-and-phase population as the overview totals and hourly buckets

#### Scenario: Unknown model entry is returned

- **WHEN** the timeline response contains the reserved `unknown` model entry
- **THEN** the table SHALL label it Unknown model and SHALL display its independently available token and cost state rather than omitting it

#### Scenario: One model metric is incomplete

- **WHEN** a model entry reports partial or unavailable tokens or estimated cost with warning codes
- **THEN** the overview SHALL distinguish that state from complete and known-zero values and expose a sanitized textual explanation without hiding known values

#### Scenario: Cost generation is stale or missing

- **WHEN** model tokens are returned while model cost is partial or unavailable because cost coverage is stale or missing
- **THEN** the overview SHALL keep the token values visible and SHALL NOT disable or hide the model breakdown

#### Scenario: No model has selected-range usage

- **WHEN** the backend returns an empty model collection
- **THEN** the overview SHALL present a successful empty model-breakdown state rather than placeholder model rows or an unavailable-data error

#### Scenario: Model breakdown is used without a pointer

- **WHEN** a keyboard or assistive-technology user reaches the model breakdown
- **THEN** they SHALL be able to identify its purpose, selected range and current phase, ordered model identities, exact values, and completeness or warning state without pointer-only interaction

#### Scenario: Background refresh fails with cached data

- **WHEN** a timeline refresh fails while a prior model breakdown is displayed
- **THEN** the overview SHALL retain the prior entries, identify the refresh failure, and offer the existing retry action
