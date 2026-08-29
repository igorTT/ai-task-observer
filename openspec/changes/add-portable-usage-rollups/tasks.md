## 1. Rollup domain and schema

- [ ] 1.1 Extend usage-timeline domain types with the `90d` range, daily bucket unit, and exact UTC range/boundary helpers.
- [ ] 1.2 Define the session-hour rollup domain record, including token metrics, cost metrics, completeness, sanitized warnings, source fact revision, and cost-generation identity.
- [ ] 1.3 Add an additive portable migration for session-hour rollups, freshness/reconciliation state, unknown-time counts, and lookup indexes without changing raw source tables.
- [ ] 1.4 Add authored database row models and repository primitives for reading, rebuilding, deleting, and reconciling rollup rows.

## 2. Rollup maintenance

- [ ] 2.1 Implement shared UTC hour-key and metric-combination logic so rollups preserve raw aggregation semantics for tokens, costs, completeness, and warnings.
- [ ] 2.2 Implement bounded rebuilds for affected session-hour keys and a repeatable startup backfill for existing observations and the latest completed cost generation.
- [ ] 2.3 Wire ingestion commits and successful cost-generation completion into asynchronous rollup refresh through the existing single-writer coordination boundary.
- [ ] 2.4 Add freshness checks, retry behavior, and source-fact fallback handling for missing, stale, failed, or interrupted rollup maintenance.
- [ ] 2.5 Ensure phase assignment mutations do not rewrite rollup rows while timeline reads apply the current assignment consistently.

## 3. Timeline API

- [ ] 3.1 Update authored API/domain models and validation for `90d` and `day` while preserving the existing `12h`/`24h` hourly contract.
- [ ] 3.2 Implement timeline reads from current session-hour rollups, using raw facts for partial boundary hours or pending rollup data.
- [ ] 3.3 Apply current phase filtering, unknown-time counting, cost-generation provenance, and empty-range behavior consistently across rollup and fallback paths.
- [ ] 3.4 Add differential verification that rollup-backed and raw-backed results match for totals, buckets, warnings, completeness, and phase filters.
- [ ] 3.5 Regenerate OpenAPI routes, schemas, and the frontend API client through `npm run generate:api`; do not hand-edit generated files.

## 4. Overview dashboard

- [ ] 4.1 Extend overview URL state and the range selector with the `90d` option while retaining default and invalid-value normalization.
- [ ] 4.2 Update overview presentation, charts, tooltips, and accessibility labels to consume `bucketUnit` and render daily buckets for `90d`.
- [ ] 4.3 Update the exact bucket table and loading/empty/incomplete states for daily intervals without changing existing metric semantics.
- [ ] 4.4 Preserve phase-filtered query keys and invalidate timeline data after phase changes, ingestion, and cost recalculation.

## 5. Regression coverage

- [ ] 5.1 Add migration and repository tests for rollup keys, rebuild idempotence, freshness state, indexes, and preservation of raw facts after failures.
- [ ] 5.2 Add maintenance tests for ingestion updates, cost-generation replacement/failure, startup backfill, retries, and asynchronous pending-state fallback.
- [ ] 5.3 Add timeline API tests for `12h`, `24h`, and `90d`, partial UTC boundaries, daily zero buckets, unknown timestamps, incomplete costs, and all phase filters.
- [ ] 5.4 Add frontend tests for 90-day URL state, daily chart/table presentation, range restoration, loading states, and phase-filtered requests.
- [ ] 5.5 Add a live or fixture-based performance check comparing raw and rollup-backed 24-hour and 90-day queries, documenting the measured result.

## 6. Verification and handoff

- [ ] 6.1 Run formatting, lint, type checks, backend and frontend tests, generated-file checks, and the production build.
- [ ] 6.2 Verify the change with `openspec validate --change "add-portable-usage-rollups" --strict` and resolve any specification or task consistency errors.
- [ ] 6.3 Document the rollup rebuild/rollback behavior and confirm that no PostgreSQL-specific dependency or migration was introduced.
