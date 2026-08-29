## MODIFIED Requirements

### Requirement: Recent usage range selection

The overview SHALL provide one shared segmented selector with `12 hours`, `24 hours`, and `90 days`
options. The selected range SHALL control both counters and both charts. The initial and fallback
selection SHALL be `12 hours`; non-default selections SHALL be represented in URL state.

#### Scenario: Overview opens without range state

- **WHEN** a user opens `/overview` without a range query value
- **THEN** the dashboard SHALL visibly select `12 hours` and request the `12h` timeline

#### Scenario: User selects twenty-four hours

- **WHEN** a user activates the `24 hours` option
- **THEN** the dashboard SHALL update the URL, request the `24h` timeline, and update both counters
  and charts together

#### Scenario: User selects ninety days

- **WHEN** a user activates the `90 days` option
- **THEN** the dashboard SHALL update the URL, request the `90d` timeline, and update both counters
  and charts together using daily buckets

#### Scenario: URL range is invalid

- **WHEN** the overview URL contains an absent, malformed, or unsupported range value
- **THEN** the dashboard SHALL normalize to the `12 hours` selection without issuing an unsupported
  API request

#### Scenario: Browser navigation restores range

- **WHEN** the user navigates backward or forward after changing the range
- **THEN** the selector, counters, and charts SHALL restore the range represented by the resulting
  URL

### Requirement: Token and estimated-cost consumption charts

The overview SHALL render separate token and configured API-equivalent estimated-cost bar charts
using the ordered backend buckets. Both charts SHALL use the same time domain, synchronize
corresponding bucket inspection, and preserve the distinction between zero, partial, and
unavailable values. Short ranges SHALL use hourly buckets and the `90d` range SHALL use daily
buckets.

#### Scenario: Hourly usage is available

- **WHEN** the selected timeline contains hourly buckets
- **THEN** the dashboard SHALL render one token bar and one estimated-cost bar per hourly bucket in
  chronological order

#### Scenario: Daily usage is available

- **WHEN** the selected timeline contains daily buckets
- **THEN** the dashboard SHALL render one token bar and one estimated-cost bar per daily bucket in
  chronological order

#### Scenario: User inspects a bucket

- **WHEN** a user hovers or keyboard-focuses a bucket in either chart
- **THEN** both charts SHALL identify the corresponding interval and expose its client-local time
  range, exact metric value, and completeness state

#### Scenario: Bucket is incomplete

- **WHEN** a bucket has partial cost or unavailable tokens
- **THEN** the affected chart SHALL distinguish that state from complete consumption and SHALL
  expose an accessible textual explanation

#### Scenario: Bucket is empty

- **WHEN** a returned bucket contains known zero usage
- **THEN** both charts SHALL retain the bucket on the shared time axis without presenting it as
  missing data

### Requirement: Exact bucket data presentation

The overview SHALL provide an Exact bucket data table for the selected usage range. The table SHALL
present each returned interval, exact token value, and exact estimated-cost value in reverse
chronological order. It SHALL NOT present a dedicated Completeness field, and SHALL identify
incomplete or unavailable state alongside each affected metric value.

#### Scenario: Exact bucket rows are displayed

- **WHEN** the selected timeline contains multiple hourly or daily buckets
- **THEN** the Exact bucket data table SHALL display the bucket with the latest interval first and
  continue in descending interval order

#### Scenario: Exact bucket columns are displayed

- **WHEN** the Exact bucket data table is rendered
- **THEN** it SHALL expose Interval, Tokens, and Estimated cost fields and SHALL NOT expose a
  Completeness field

#### Scenario: A bucket metric is not complete

- **WHEN** a bucket has an incomplete or unavailable token or estimated-cost value
- **THEN** the table SHALL identify that state alongside the affected value without using a
  dedicated Completeness field
