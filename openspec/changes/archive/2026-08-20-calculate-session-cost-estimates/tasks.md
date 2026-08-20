## 1. Pricing Configuration

- [x] 1.1 Add the versioned `backend/config/models.json` catalog and validated optional configuration path with schema version, catalog version, USD token unit, canonical IDs, exact aliases, UTC price periods, and decimal-string rates.
- [x] 1.2 Implement strict catalog parsing, SHA-256 identity, exact alias indexing, half-open UTC period validation, and startup-fatal sanitized errors for missing, malformed, ambiguous, invalid-rate, or overlapping configuration.
- [x] 1.3 Add valid and invalid catalog fixtures covering canonical self-resolution, exact aliases, adjacent periods, deliberate price gaps, overlaps, duplicate aliases, unsupported schema versions, invalid UTC boundaries, and decimal-rate failures.
- [x] 1.4 Add startup/configuration tests proving invalid catalogs prevent the listener while unknown runtime models do not affect backend health.

## 2. Decimal Pricing Domain

- [x] 2.1 Add pricing domain types and fixed-decimal helpers that never convert token counts, rates, or USD results through JavaScript `number`.
- [x] 2.2 Implement exact canonical/alias and observation-time price resolution with no case, prefix, fuzzy, current-price, or timestamp fallback.
- [x] 2.3 Implement component calculation for uncached input, cached input, and output plus partial/null estimate and completeness behavior.
- [x] 2.4 Add calculator fixtures using a one-million-token unit, including the exact case of 1,000 input with 400 cached and 200 output at rates 2.00/0.50/8.00, which SHALL yield `0.003` USD.
- [x] 2.5 Add unit tests for effective-boundary selection, price gaps, unknown models/timestamps, malformed token categories, zero usage, multiple models, multiple periods, and exact decimal serialization.

## 3. Immutable Calculation Generations

- [x] 3.1 Add an ordered SQL migration for immutable calculation generations and per-observation items with config/calculator identity, source-fact revision, exact rates, decimal component results, completeness, and sanitized status.
- [x] 3.2 Add passive generation/item models and parameterized repositories for creating runs, atomically completing item sets, recording failure, and selecting the newest completed generation.
- [x] 3.3 Implement the calculation service over a stable committed observation revision and retain observed/canonical model, selected period, exact rates, components, gaps, and anomaly provenance per item.
- [x] 3.4 Add repository/service tests proving failed or running generations never shadow the previous completed generation, historical rates remain readable, and recalculation never mutates observations or prior generations.

## 4. Lifecycle and Operations

- [x] 4.1 Add a serialized/coalesced calculation coordinator that ensures current startup coverage and schedules a debounced generation after committed fact revisions.
- [x] 4.2 Add authored tsoa status and explicit-recalculation operations with generated-contract response models for latest, active, queued, coverage, config/calculator identity, and sanitized failure state.
- [x] 4.3 Add coordinator and Supertest tests for initial calculation, repeated triggers, request-during-active behavior, failure recovery, configuration/calculator changes, and a newly imported uncovered observation.
- [x] 4.4 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client in the root generation step; keep generated artifacts separate from authored changes.

## 5. Verification

- [x] 5.1 Run focused pricing, migration, repository, coordinator, startup, and API tests, including deterministic repeated calculation against the same config hash and fact revision.
- [x] 5.2 Run formatting, lint, type checking, generated-file verification, workspace tests, and builds for the completed change.
