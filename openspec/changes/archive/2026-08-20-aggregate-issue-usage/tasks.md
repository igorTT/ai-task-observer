## 1. Shared Aggregation Contract

- [x] 1.1 Add authored response/domain models for issue identity, nullable usage metrics, token/cost completeness, anomalies, sessions, models, UTC/null daily buckets, and latest completed cost-generation identity.
- [x] 1.2 Add shared mapping utilities that serialize bigint counts and fixed-decimal USD values as strings and never turn unknown categories into zero.
- [x] 1.3 Define deterministic ordering and pagination semantics for issue, session, model, and daily response collections, including the explicit null-date bucket.

## 2. DuckDB Aggregation Repositories

- [x] 2.1 Implement a shared parameterized SQL metric projection over current committed session links, canonical user-message events, normalized usage observations, and items from only the latest completed cost generation.
- [x] 2.2 Implement issue population/count/list queries that omit unlinked sessions and cached issues without currently linked sessions.
- [x] 2.3 Implement issue-detail session and model queries that preserve free-form phase as metadata, bucket unresolved models as `unknown`, and do not group by phase.
- [x] 2.4 Implement UTC daily queries assigning turns by user-message time and tokens/cost by observation time, with null timestamps in the unknown bucket and distinct non-additive session counts.
- [x] 2.5 Propagate per-category nullability, token/cost completeness, uncovered-generation state, pricing gaps, and anomaly codes consistently through every grouping level.

## 3. Representative Accounting Fixtures

- [x] 3.1 Build a temporary-DuckDB fixture with two issues, multiple linked/unlinked sessions, two UTC dates, null timestamps, repeated activity within a day, multiple models, an unknown model, an invalid cached-input category, and one session phase.
- [x] 3.2 Add repository assertions that additive turn/token/cost metrics reconcile from daily buckets including unknown time, while one session spanning two days counts once all-time and once in each active day.
- [x] 3.3 Add assertions that valid categories remain available, invalid aggregate categories are null, known costs form a partial estimate, and completeness/anomaly fields identify every gap.
- [x] 3.4 Add relink assertions proving a title candidate changes nothing, successful relink moves the full session history, failed relink preserves totals, and the former issue disappears when its last current session moves.
- [x] 3.5 Add generation assertions proving running/failed or stale uncovered calculations do not mix with the latest completed generation and uncovered observations make cost incomplete.

## 4. Query Services and HTTP API

- [x] 4.1 Implement an issue-usage query service that assembles list/detail responses from repository rows without calling Linear or recalculating pricing.
- [x] 4.2 Add thin authored tsoa operations for bounded `GET /api/issues/usage` and stable-ID `GET /api/issues/{issueId}/usage`, including documented validation and not-found responses.
- [x] 4.3 Add Supertest scenarios for deterministic pagination, complete detail, multiple models, UTC/unknown days, zero-current-session not found, unlinked exclusion, partial import visibility, and relink behavior.
- [x] 4.4 Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client in the root generation step; do not add dashboard screens or hand-edit generated outputs.
- [x] 4.5 Add focused generated-client contract verification for nullable metrics, decimal strings, null daily dates, and nested session/model breakdowns.

## 5. Verification

- [x] 5.1 Run focused repository, query-service, API, generated-contract, and existing Linear attribution regression tests.
- [x] 5.2 Run formatting, lint, type checking, generated-file verification, workspace tests, builds, and backend smoke verification for the completed change.
