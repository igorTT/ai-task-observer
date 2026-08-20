## 1. Frontend data and presentation foundations

- [x] 1.1 Add only the required shadcn/ui and Playwright dependencies, authored primitives, and browser-test configuration; update the lockfile without editing generated API files.
- [x] 1.2 Add an authored RTK Query endpoint enhancement with focused tags for issue usage, sessions, import status, Linear status, and cost status, including mutation invalidation tests.
- [x] 1.3 Implement exact decimal-count, nullable-token, USD, UTC/unknown-date, duration, and sanitized-code formatters with mirrored unit tests covering values beyond the JavaScript safe integer range.
- [x] 1.4 Implement shared pagination parsing and API-error normalization with tests for missing, malformed, negative, stale-page, documented, and unknown failures.
- [x] 1.5 Add the minimal shared badge, card, table, alert, skeleton, dialog, and pagination primitives with accessible names and focus behavior tests where interaction is involved.

## 2. Application shell and routing

- [x] 2.1 Replace the foundation placeholder with a persistent responsive shell containing product identity, issue and session navigation, density preference, and an operational-status entry point.
- [x] 2.2 Define `/issues`, `/issues/:issueId`, and `/sessions` routes plus the root redirect, contextual not-found boundary, and route-level loading/error boundaries.
- [x] 2.3 Implement URL-owned one-based pagination for issue and session lists, including normalization and browser-history restoration.
- [x] 2.4 Add mirrored shell and routing tests for direct issue URLs, active navigation, root redirect, invalid pagination, narrow navigation, and back/forward behavior.

## 3. Issue-usage overview

- [x] 3.1 Build the issue-usage page on the enhanced generated query hook with initial loading, background refresh, populated, true-empty, later-empty-page, and failure states.
- [x] 3.2 Build responsive issue summary records showing identity, local detail and external Linear links, all required metrics, completeness, anomalies, and pricing gaps without client-side recomputation.
- [x] 3.3 Add overview tests for deterministic API order, exact metric formatting, null versus zero, partial estimates, external-link safety, pagination, retry, and navigation to sessions from the empty state.

## 4. Issue usage detail

- [x] 4.1 Build the issue-detail header and metric summary with external Linear navigation, cost-generation provenance, refresh indication, and contextual not-found behavior.
- [x] 4.2 Build contributing-session records with phase, import state, timestamps, metrics, per-session model data, completeness, and sanitized warnings.
- [x] 4.3 Build ordered model and UTC-daily breakdowns that label unknown models and time explicitly and document non-additive daily session counts.
- [x] 4.4 Add detail tests for multiple sessions and models, free-form phase metadata, unknown buckets, incomplete metrics, absent cost generation, import failures with committed data, retry, and not-found navigation.

## 5. Session attribution and relinking

- [x] 5.1 Build the paginated session view showing stable identity, current title, usage/import state, candidate, phase, committed issue, synchronization state, and sanitized failure information.
- [x] 5.2 Render unlinked, unconfigured, pending, linked, not-found, error, and changed-candidate states while keeping committed issue and title candidate visually distinct.
- [x] 5.3 Implement explicit initial-link and replacement-relink dialogs using the existing relink mutation, with current/candidate context, pending protection, disabled prerequisites, and no arbitrary issue input.
- [x] 5.4 Refresh affected session, issue-usage, and Linear-status data only after confirmed relink success; preserve prior committed display and present safe retry guidance on failure.
- [x] 5.5 Add session and relink tests for every attribution state, duplicate submission prevention, confirmation cancellation, success invalidation, stale title, missing candidate, unconfigured Linear, not found, and transient failure.

## 6. Operational status and actions

- [x] 6.1 Build the shell status summary and detail presentation for import roots/runs/checkpoints, Linear configuration/runs/counts, and cost coverage/generations.
- [x] 6.2 Implement rescan, Linear sync, and cost recalculation actions with queued/running feedback, pending guards, sanitized failures, and targeted cache invalidation.
- [x] 6.3 Add bounded polling that runs only while a returned subsystem state is active or queued and stops on terminal, unconfigured, unavailable, or component-unmounted state.
- [x] 6.4 Add operational tests for healthy, unavailable-root, warning/error, unconfigured, stale/missing coverage, coalesced work, successful refresh, failed mutation, retry, and polling termination.

## 7. Responsive, end-to-end, and release verification

- [x] 7.1 Verify and test keyboard order, visible focus, dialog focus management, live status announcements, text-plus-color warnings, and semantic table or stacked-record labels.
- [x] 7.2 Add Playwright coverage with deterministic API interception for issue overview-to-detail navigation, an unlinked or changed-candidate relink flow, and an operational failure followed by retry.
- [x] 7.3 Exercise the critical pages at narrow and wide viewports, resolve overflow or hidden-information defects, and capture review screenshots for the frontend change.
- [x] 7.4 Update frontend and root documentation with dashboard routes, state ownership, test commands, metric caveats, and current capability status.
- [x] 7.5 Run focused frontend tests during implementation, then run generated-file verification, formatting, lint, type checking, all Bun tests, frontend/backend builds, backend smoke verification, and the Playwright suite before completion.
