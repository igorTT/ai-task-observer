## MODIFIED Requirements

### Requirement: Honest metric formatting

The dashboard SHALL format token counts as compact decimal-string values for human reading without
using unsafe numeric conversion, converting unavailable values to zero, or overstating usage.
Token counts below one thousand SHALL remain exact. Larger token counts SHALL use lowercase `k`,
`m`, `b`, or `t` suffixes, with the `t` unit retained for values beyond its base range. The
dashboard SHALL retain one non-zero truncated decimal digit when the scaled whole value is below
100, SHALL omit a zero fractional digit, and SHALL omit the decimal digit when the scaled whole
value is 100 or greater. Non-token counts and USD estimates SHALL retain their existing formatting.
Cached input SHALL be shown as a subset of input rather than added to total tokens a second time.

#### Scenario: Token count is below the compact threshold

- **WHEN** a token count is between `0` and `999`
- **THEN** the dashboard SHALL display the exact decimal value without a magnitude suffix

#### Scenario: Token count has a scaled value below one hundred

- **WHEN** a token count scales below 100 in its selected magnitude, such as `1,700,000` or `12,700,000`
- **THEN** the dashboard SHALL display one truncated decimal digit, such as `1.7m` or `12.7m`

#### Scenario: Compact token count has no fractional remainder

- **WHEN** a token count scales to a whole value, such as `1,000,000`
- **THEN** the dashboard SHALL display `1m` without a trailing `.0`

#### Scenario: Token count has a scaled value of at least one hundred

- **WHEN** a token count scales to at least 100 in its selected magnitude, such as `990,673`
- **THEN** the dashboard SHALL omit the fractional part and display the truncated whole value, such as `990k`

#### Scenario: Compact token count approaches the next magnitude

- **WHEN** discarded digits would round the compact value into the next magnitude, such as `999,999`
- **THEN** the dashboard SHALL truncate the value to `999k` rather than round it to `1m`

#### Scenario: Count exceeds JavaScript safe integer range

- **WHEN** a token count returned as a decimal string exceeds the safe integer range
- **THEN** the dashboard SHALL derive its compact label without passing the count through an unsafe numeric representation

#### Scenario: Metric is unavailable

- **WHEN** a token category or estimated cost is null
- **THEN** the dashboard SHALL render an unavailable marker and the applicable completeness state rather than `0`

#### Scenario: Token metric is invalid

- **WHEN** a token value is not a valid non-negative decimal count
- **THEN** the dashboard SHALL render an unavailable marker rather than a misleading compact label

#### Scenario: Non-token count is displayed

- **WHEN** the dashboard displays a session count or developer-turn count
- **THEN** it SHALL retain the existing exact grouped-count presentation without a compact suffix

#### Scenario: Cached input is displayed

- **WHEN** input and cached-input token values are available
- **THEN** the dashboard SHALL label cached input separately and SHALL display the backend total without adding cached input again
