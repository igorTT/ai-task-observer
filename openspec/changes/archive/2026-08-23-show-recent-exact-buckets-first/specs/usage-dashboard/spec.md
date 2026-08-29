## ADDED Requirements

### Requirement: Exact bucket data presentation

The overview SHALL provide an Exact bucket data table for the selected recent-usage range. The
table SHALL present each returned interval, exact token value, and exact estimated-cost value in
reverse chronological order. It SHALL NOT present a dedicated Completeness field, and SHALL
identify incomplete or unavailable state alongside each affected metric value.

#### Scenario: Exact bucket rows are displayed

- **WHEN** the selected timeline contains multiple hourly buckets
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
