## Purpose

Calculates reproducible configured API-equivalent USD estimates from normalized session usage while
preserving exact pricing provenance and clearly exposing unknown or partial costs.

## ADDED Requirements

### Requirement: Versioned pricing configuration

The system SHALL load pricing from a versioned JSON configuration containing a schema version,
catalog version, USD token unit, canonical model IDs, exact aliases, and UTC-effective price
periods with uncached-input, cached-input, and output rates.

#### Scenario: Valid configuration is loaded

- **WHEN** the configured pricing file satisfies the supported schema and all catalog invariants
- **THEN** the backend SHALL make its catalog version and content hash available to the calculator

#### Scenario: Canonical identifier is observed

- **WHEN** an observation model exactly equals a configured canonical model ID
- **THEN** the system SHALL resolve it to that canonical model without requiring a duplicate alias

### Requirement: Startup-fatal configuration validation

The backend SHALL fail startup before serving requests when the pricing file is missing,
unreadable, malformed, unsupported, or semantically invalid. Validation SHALL reject negative or
non-decimal rates, empty or duplicate identities, aliases assigned to multiple canonical models,
invalid UTC boundaries, and overlapping periods for a model.

#### Scenario: Pricing periods overlap

- **WHEN** two price periods for one canonical model overlap
- **THEN** startup SHALL fail with a sanitized configuration error

#### Scenario: Alias is ambiguous

- **WHEN** one exact alias is assigned to multiple canonical models
- **THEN** startup SHALL fail instead of selecting either model

#### Scenario: Rate is invalid

- **WHEN** a configured rate is negative, non-finite, or not a valid decimal value
- **THEN** startup SHALL fail without opening the HTTP listener

### Requirement: Exact time-aware model resolution

The system SHALL resolve an observed model only by exact canonical ID or exact configured alias and
SHALL select the half-open UTC price period whose `effectiveFrom` is at or before the observation
time and whose `effectiveTo`, when present, is after it. It SHALL NOT use fuzzy, case-folded, prefix,
or default-model matching.

#### Scenario: Alias and period match

- **WHEN** an exact alias resolves to a canonical model and the observation time falls in one price period
- **THEN** the calculator SHALL use that canonical model and that period's exact rates

#### Scenario: Observed model is unknown

- **WHEN** no exact canonical ID or alias matches an observed model
- **THEN** the observation SHALL remain token-counted but its model-priced components SHALL be unavailable

#### Scenario: Observation time is unknown

- **WHEN** an observation has no source timestamp
- **THEN** the calculator SHALL NOT substitute import time, session time, or the current price and SHALL mark its cost incomplete

#### Scenario: Price period has a gap

- **WHEN** a known model has no effective price period at the observation time
- **THEN** the calculator SHALL retain the usage, price no affected component, and mark its cost incomplete

### Requirement: API-equivalent USD calculation

The system SHALL calculate `estimatedCostUsd` from normalized token deltas using exact decimal
arithmetic: uncached input times its rate, cached input times its rate, and output times its rate,
each divided by the configured token unit. The result SHALL be described as configured estimated
API-equivalent cost and SHALL NOT be represented as billed spend.

#### Scenario: Complete observation is priced

- **WHEN** all normalized categories, model, time, and applicable rates are known
- **THEN** its estimate SHALL equal the sum of the three independently calculated price components and `costComplete` SHALL be true

#### Scenario: Session uses multiple models

- **WHEN** one session has observations resolved to multiple canonical models or price periods
- **THEN** the session estimate SHALL sum each observation using its own resolved rates and retain a per-model breakdown

#### Scenario: Cached input is priced

- **WHEN** input contains cached input
- **THEN** only uncached input SHALL receive the uncached-input rate and cached input SHALL receive the cached-input rate

### Requirement: Partial and unknown estimates

The calculator SHALL preserve independently priceable components when another component is
unknown and SHALL expose `costComplete: false`. `estimatedCostUsd` SHALL be null when no component
is priceable and otherwise SHALL contain only the known partial estimate.

#### Scenario: Output is priceable but input split is invalid

- **WHEN** output and its rate are known but cached and uncached input are unknown
- **THEN** the estimate SHALL include output cost only and SHALL report `costComplete: false`

#### Scenario: Nothing is priceable

- **WHEN** no token component has both a valid normalized count and applicable rate
- **THEN** `estimatedCostUsd` SHALL be null and `costComplete` SHALL be false

#### Scenario: Unknown model appears beside known model

- **WHEN** a session contains usage from both configured and unknown models
- **THEN** known-model components SHALL contribute to a partial estimate, unknown-model usage SHALL remain visible, and session `costComplete` SHALL be false

### Requirement: Immutable calculation generations

Each calculation run SHALL create an immutable generation containing status, creation and
completion times, pricing schema/catalog version and content hash, calculator version, exact
applied rates, source observation identity, resolved model/period, component results, and
completeness. Readers SHALL use only the latest completed generation.

#### Scenario: Calculation succeeds

- **WHEN** every target observation has been evaluated and the generation commits
- **THEN** the generation SHALL become completed and eligible as the latest queryable result

#### Scenario: Calculation fails

- **WHEN** a generation cannot finish atomically
- **THEN** it SHALL NOT replace the previous latest completed generation and SHALL expose a sanitized failed status

#### Scenario: Applied rate is inspected later

- **WHEN** a historical estimate is audited after the JSON configuration changes
- **THEN** its generation SHALL still expose the exact rates, config identity, calculator version, and source observations used

### Requirement: Explicit reproducible recalculation

The system SHALL support explicitly calculating a new generation after usage, pricing, or
calculator changes without mutating prior completed generations or source usage facts.

#### Scenario: Pricing catalog changes

- **WHEN** an explicit recalculation runs with a different valid catalog
- **THEN** it SHALL create a new generation and preserve every earlier completed generation

#### Scenario: Recalculation is not requested

- **WHEN** a pricing file changes after a completed calculation but no new generation completes
- **THEN** queries SHALL continue returning the prior latest completed generation

### Requirement: Observable calculation operations

The backend SHALL expose generated-contract operations for calculation status and explicit local
recalculation. Repeated requests SHALL coalesce with active or queued calculation work and SHALL
not create a competing DuckDB writer.

#### Scenario: Calculation status is requested

- **WHEN** a client requests cost-calculation status
- **THEN** the backend SHALL report the latest completed generation, any active or queued generation, config and calculator identity, coverage state, and sanitized failure category

#### Scenario: Explicit recalculation is requested

- **WHEN** a client requests recalculation while no generation is active
- **THEN** the backend SHALL accept a new generation and return its identity and state

#### Scenario: Recalculation is requested during an active run

- **WHEN** a recalculation request arrives while calculation is active
- **THEN** the backend SHALL return the active or coalesced queued state without starting overlapping writes
