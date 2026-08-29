## ADDED Requirements

### Requirement: Session-phase estimated-cost comparison

The overview SHALL render an estimated-cost donut comparison for the selected range using the
backend-supplied authoritative all-phase total and phase entries. The visual and its accessible
equivalent SHALL identify every canonical current session phase plus Unassigned, preserve exact
amounts and partial or unavailable state, and update from the same request as the existing counters
and hourly charts.

#### Scenario: All phases are selected

- **WHEN** the overview phase control is set to All and complete phase comparison data is returned
- **THEN** the donut SHALL show the complete phase distribution, place the all-phase estimated cost at its center, and expose each phase's exact amount and share of the all-phase total

#### Scenario: Apply phase is selected

- **WHEN** the overview phase control is set to Apply
- **THEN** the donut SHALL visually emphasize Apply and identify its exact estimated cost and share of the authoritative all-phase total while retaining the amounts for every other phase

#### Scenario: Range changes

- **WHEN** the user changes between the 12-hour and 24-hour ranges
- **THEN** the selected-phase counters, hourly charts, comparison donut, all-phase total, and phase amounts SHALL update together from the resulting timeline response

#### Scenario: Selected phase has zero cost

- **WHEN** the selected phase has complete zero estimated cost while another phase has positive cost
- **THEN** the overview SHALL identify the selected phase as a known zero and SHALL NOT invent a visible non-zero slice for it

#### Scenario: Entire range has zero cost

- **WHEN** the all-phase comparison reports complete zero estimated cost
- **THEN** the overview SHALL present a successful no-cost comparison state and exact zero values rather than an unavailable chart

#### Scenario: Comparison cost is partial

- **WHEN** the comparison total or any phase amount is a known partial estimate
- **THEN** the overview SHALL label the donut as a distribution of known estimated cost and expose the affected partial state without presenting it as complete spend

#### Scenario: Comparison cost is unavailable

- **WHEN** the comparison provides no known estimated cost
- **THEN** the overview SHALL show an unavailable comparison state and SHALL NOT render zero-valued slices that imply no spend

#### Scenario: Comparison is used without a pointer

- **WHEN** a keyboard or assistive-technology user reaches the phase comparison
- **THEN** they SHALL be able to identify its purpose, selected range and phase, authoritative all-phase amount, ordered phase amounts, shares, and completeness state without hovering the donut

#### Scenario: Comparison refresh fails with cached data

- **WHEN** a background timeline refresh fails while a prior comparison is displayed
- **THEN** the overview SHALL retain the prior donut and accessible values, identify the refresh failure, and offer the existing retry action
