## Why

The Exact bucket data table currently makes users scan from the oldest interval to reach the most
recent usage and repeats completeness in a dedicated column after already annotating affected
values. Prioritizing recent rows and removing that redundant field makes the table faster to read
without hiding incomplete or unavailable metric states.

## What Changes

- Display Exact bucket data rows in reverse chronological order, with the most recent interval
  first, without changing the backend timeline or chart ordering.
- Remove the dedicated Completeness column from the Exact bucket data table.
- Retain inline incomplete and unavailable status alongside the affected token or estimated-cost
  value so metric state remains accessible without the removed column.
- Add regression coverage for row ordering, the reduced column set, and incomplete values.
- Non-goals: changing timeline API ordering or contracts, changing chart ordering or tooltip
  behavior, or changing how completeness and warning states are calculated.
- Dependencies: relies on the existing usage overview charts and Exact bucket data table; it has no
  dependency on another active change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Change the accessible Exact bucket data presentation to prioritize recent
  intervals and omit the redundant Completeness field while preserving per-metric status.

## Impact

- Frontend overview table rendering and focused React tests are affected.
- The existing `usage-dashboard` behavioral specification receives a delta.
- Backend repositories, generated API artifacts, persisted data, and dependencies are unchanged.
