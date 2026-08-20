## Why

Token totals alone cannot explain the economic weight of a Codex session, while model prices and
names change over time. AI Task Observer needs reproducible API-equivalent cost estimates whose
pricing inputs and calculation provenance remain auditable.

## What Changes

- Load a versioned JSON model/pricing configuration containing canonical model IDs, exact aliases,
  UTC effective periods, and separate uncached-input, cached-input, and output rates.
- Validate the complete pricing configuration at startup and fail startup for malformed versions,
  aliases, rates, date ranges, or overlapping periods.
- Resolve each normalized usage observation by exact model alias and observation timestamp; do not
  use fuzzy, prefix, or default-model matching.
- Calculate `estimatedCostUsd` as configured API-equivalent cost, not billed spend, across every
  model used by a session.
- Keep token facts when a model or applicable price is unknown, calculate any independently
  priceable components, and expose incomplete estimates without guessing.
- Persist immutable calculation generations with config version and hash, calculator version,
  applied rates, timestamps, status, and per-observation provenance; queries use the latest
  completed generation while earlier generations remain auditable.
- Support explicit recalculation after pricing or calculator changes without mutating raw usage
  facts or prior completed generations.
- Dependency: `persist-session-usage-events` supplies normalized model- and time-aware usage facts;
  project foundation and Codex ingestion are also upstream.
- Non-goals: database-managed model catalogs, fetching live prices, billed-cost reconciliation,
  currency conversion, issue/date/phase aggregation, dashboards, and frontend work.

## Capabilities

### New Capabilities

- `session-cost-estimation`: Versioned pricing configuration, validated model resolution,
  reproducible session cost generations, and explicit incomplete-estimate behavior.

### Modified Capabilities

None.

## Impact

This change adds backend JSON configuration and validation, pricing and calculation services,
DuckDB migrations, passive cost-generation models, repositories, operational status, and focused
unit/repository tests. It does not require Linear access or an issue-usage HTTP contract.
