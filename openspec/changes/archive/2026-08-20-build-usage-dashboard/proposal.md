## Why

The backend can now import, attribute, price, and aggregate Codex usage, but those results are only
available through HTTP endpoints. A local dashboard is needed so a developer can understand issue
cost and effort, inspect the contributing sessions, and notice attribution or processing problems
without manually querying the API.

## What Changes

- Replace the frontend foundation placeholder with a responsive application shell and routed
  issue-usage, issue-detail, and session-attribution views.
- Present issue-level session counts, developer turns, token categories, estimated cost,
  completeness, and anomaly state using the generated RTK Query client.
- Present one issue's contributing sessions plus model and UTC-daily breakdowns while clearly
  distinguishing unavailable values from zero and warning that daily session counts are
  non-additive.
- Provide a session view for finding unlinked, unresolved, failed, or changed-title sessions and
  for explicitly applying a valid relink candidate.
- Surface import, Linear synchronization, and cost-calculation status with manual rescan, sync, and
  recalculation actions using the existing backend operations.
- Keep shareable navigation and pagination in the URL, remote data in RTK Query, and display-only
  preferences in Zustand.
- Add mirrored component, feature, route, and state tests plus a small Playwright suite covering
  the critical dashboard flows.
- Dependencies: the implemented `project-foundation`, `codex-session-ingestion`,
  `linear-session-attribution`, `session-usage-events`, `session-cost-estimation`, and
  `issue-usage-aggregation` capabilities supply the shell, generated client, and server data.
- Non-goals: changing accounting or attribution semantics; adding new dashboard-specific backend
  aggregation; reading Codex files, DuckDB, or Linear from the browser; arbitrary issue assignment;
  phase aggregation; charts requiring a new visualization dependency; authentication, remote or
  multi-user hosting; Docker packaging; MCP; and the later Codex-initiated linking workflow.

## Capabilities

### New Capabilities

- `usage-dashboard`: Routed, local frontend behavior for issue accounting, session attribution,
  operational status, safe mutations, loading and failure states, and responsive presentation.

### Modified Capabilities

None. The dashboard consumes the existing generated HTTP contract without changing its required
backend behavior.

## Impact

- Primary changes are under `frontend/src/app`, `frontend/src/features`, shared frontend
  components and utilities, the mirrored `frontend/__tests__` tree, and `frontend/e2e`.
- The generated RTK Query client remains the only server-data boundary and is not hand-edited.
- Existing backend routes are consumed as-is; no DuckDB migration or Linear SDK behavior is
  expected.
- Additional shadcn/ui primitives may be authored or generated under `frontend/src/components/ui`.
- The production-container work remains a separate roadmap change.
