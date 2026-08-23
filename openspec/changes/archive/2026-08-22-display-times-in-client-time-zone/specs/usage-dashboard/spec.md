## ADDED Requirements

### Requirement: Client-zone timestamp presentation

The dashboard SHALL present timestamp instants in the client browser's current time zone while
preserving their represented instant. It SHALL continue to present UTC calendar-day aggregation
keys as UTC dates and SHALL distinguish unavailable or invalid timestamp values from valid times.

#### Scenario: Timestamp instant is displayed

- **WHEN** a dashboard view receives a valid timestamp instant from the API
- **THEN** the dashboard SHALL display the corresponding date and time in the client browser's current time zone

#### Scenario: Local date differs from UTC date

- **WHEN** converting a valid timestamp instant to the client browser's current time zone crosses a calendar-day boundary
- **THEN** the dashboard SHALL display the local calendar date and time rather than the UTC calendar date and time

#### Scenario: Timestamp is unavailable or invalid

- **WHEN** a timestamp field is absent, null, empty, or invalid
- **THEN** the dashboard SHALL display an unknown-time marker without inventing a date or time

#### Scenario: UTC daily usage bucket is displayed

- **WHEN** issue detail displays a daily-usage bucket identified by a UTC calendar date
- **THEN** the dashboard SHALL preserve the returned date and identify the breakdown as UTC rather than converting the bucket to the client time zone
