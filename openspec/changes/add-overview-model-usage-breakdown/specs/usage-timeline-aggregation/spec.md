## ADDED Requirements

### Requirement: Selected-population model usage breakdown

Every recent-usage response SHALL include a model breakdown calculated from the same committed
known-time observations, half-open selected range, captured end instant, and optional current
session-phase filter as the response totals and hourly buckets. The breakdown SHALL include linked
and unlinked sessions on the same terms as the existing global timeline and SHALL contain only
model buckets with at least one contributing observation.

#### Scenario: All phases are selected

- **WHEN** a client requests a recent-usage timeline without a session-phase filter
- **THEN** the model breakdown SHALL cover every committed linked and unlinked known-time observation in the selected range

#### Scenario: One current phase is selected

- **WHEN** a client requests a timeline filtered to one current session phase or Unassigned
- **THEN** the model breakdown SHALL contain only observations in that same selected population and SHALL remain synchronized with the response totals and buckets

#### Scenario: Observation time is unknown

- **WHEN** a selected session has a committed observation without a valid source timestamp
- **THEN** that observation SHALL NOT contribute to a model entry and SHALL remain represented only by the existing filtered unknown-time observation count

#### Scenario: Selected range has no usage

- **WHEN** no committed known-time observation falls in the selected population and range
- **THEN** the response SHALL return an empty model collection rather than zero entries for hard-coded models

### Requirement: Deterministic canonical and unknown model identity

Each contributing observation SHALL belong to exactly one model bucket. The system SHALL prefer a
non-null canonical model identity retained by the selected completed cost item, otherwise resolve
the observation's exact model identity through the currently loaded pricing catalog, and otherwise
place it in one reserved `unknown` bucket. It SHALL NOT use fuzzy, case-folded, prefix, or default
model matching. Known model buckets SHALL use deterministic canonical-identity order and the
unknown bucket SHALL sort last.

#### Scenario: Completed item supplies canonical identity

- **WHEN** the selected completed cost item records a canonical model for an observation
- **THEN** the breakdown SHALL use that retained canonical identity even when cost-generation coverage is stale

#### Scenario: Alias lacks a completed item

- **WHEN** an uncovered observation reports exact alias `gpt-5.6` and the loaded catalog assigns that alias to `gpt-5.6-sol`
- **THEN** its tokens SHALL contribute to the `gpt-5.6-sol` bucket without requiring cost-generation coverage

#### Scenario: Terra has selected-range usage

- **WHEN** one or more selected observations resolve to `gpt-5.6-terra`
- **THEN** the response SHALL include a Terra entry rather than limiting the collection to Sol and Luna

#### Scenario: Model cannot be resolved

- **WHEN** an observation has no completed canonical identity and its exact observed identity is not configured in the loaded catalog
- **THEN** its usage SHALL contribute to one explicit `unknown` bucket without exposing a guessed canonical model

#### Scenario: Catalog contains another canonical model

- **WHEN** selected observations resolve to a configured canonical model other than the currently known Sol, Terra, and Luna examples
- **THEN** the response SHALL include that canonical model dynamically without requiring a contract-shape change

### Requirement: Exact independent model metrics

Every model entry SHALL return total tokens and configured API-equivalent estimated cost as exact
decimal strings or null, with separate token and cost completeness plus sanitized warning state.
Token completeness SHALL depend only on the normalized observations in that model bucket. Cost
values, completeness, and warnings SHALL use the selected latest completed cost generation and
SHALL preserve known partial components independently of token availability.

#### Scenario: Model entry is complete

- **WHEN** all observations in a model bucket have complete normalized total tokens and complete selected-generation cost items
- **THEN** the entry SHALL return exact token and cost sums with complete token and cost state

#### Scenario: No completed cost generation exists

- **WHEN** a model bucket has complete token observations but no completed cost generation is available
- **THEN** its total tokens SHALL remain exact and complete while estimated cost SHALL be null and unavailable

#### Scenario: Stale generation covers only part of a model

- **WHEN** the selected completed generation provides known cost for some observations in a model bucket and does not cover others
- **THEN** the entry SHALL preserve the known estimated cost, mark cost partial, expose sanitized uncovered-generation warning state, and retain independently complete tokens

#### Scenario: Model token total is incomplete

- **WHEN** any observation in one model bucket lacks a normalized total-token value
- **THEN** that entry's total tokens SHALL be null with unavailable token state without making independently complete model entries unavailable

#### Scenario: Unknown model retains tokens

- **WHEN** a complete token observation belongs to the unknown model bucket and cannot be priced
- **THEN** its tokens SHALL remain available while its cost is unavailable or partial according to the selected generation

#### Scenario: Breakdown reconciles with overall totals

- **WHEN** every selected observation has complete normalized total tokens and complete cost
- **THEN** the exact model token and cost sums SHALL equal the corresponding selected-range overall totals
