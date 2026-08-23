## Why

The dashboard currently forces displayed timestamp instants into UTC, so users outside UTC see
session and operation times that do not match their current local time. Timestamp presentation
should follow the client browser's current time zone while preserving intentional UTC calendar-day
aggregation.

## What Changes

- Display timestamp instants using the client browser's current time zone across the dashboard.
- Keep unavailable or invalid timestamps labeled as unknown rather than synthesizing a time.
- Keep issue daily-usage dates and their UTC labeling unchanged because they are aggregate bucket
  identifiers, not timestamp instants.
- Add deterministic frontend coverage for client-zone conversion and existing fallback behavior.
- Non-goals: changing timestamp storage or API serialization, localizing UTC daily aggregation,
  adding a selectable time-zone preference, or changing the fixed display locale.
- Dependencies on other planned changes: none; this change is independently reviewable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Require dashboard timestamp instants to be presented in the client browser's
  current time zone while retaining UTC daily-usage buckets.

## Impact

- Affects the shared frontend date-time formatter and its timestamp consumers in session, issue,
  and operation views.
- Adds or updates frontend formatter tests for time-zone-sensitive output.
- Does not change backend behavior, generated API contracts, persisted data, dependencies, or UTC
  daily aggregation semantics.
