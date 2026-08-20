## Context

See `proposal.md` for motivation and `specs/usage-dashboard/spec.md` for observable behavior. The
frontend is currently a small routed React shell with one shadcn-style button, a generated RTK
Query service, Redux configured only for that service, and one Zustand density preference. The
generated contract now exposes issue usage list/detail, session list/detail/relink, import
status/rescan, Linear status/sync, and cost status/recalculation operations.

The issue API deliberately returns decimal strings for counts and cost, nullable incomplete
metrics, sanitized anomaly and pricing-gap codes, deterministic collections, and a null UTC-date
bucket. The browser must present those semantics rather than recreate them. It must remain an HTTP
client: the backend stays the sole DuckDB writer and the sole Linear SDK consumer.

## Goals / Non-Goals

**Goals:**

- Establish a feature-oriented dashboard structure that can grow without turning the application
  shell or route module into a collection of business logic.
- Make issue cost and effort legible at overview and detail levels while preserving completeness,
  provenance, and non-additive count semantics.
- Give attribution and operational problems a clear path to inspection and safe retry.
- Keep navigation shareable, mutations explicit, data ownership unambiguous, and the first UI
  usable on desktop and narrow screens.
- Provide deterministic component and route tests with a thin real-browser confidence layer.

**Non-Goals:**

- Client-side accounting, issue matching, pricing, or persistence.
- A generic analytics or charting framework, arbitrary table builders, or a broad design system.
- Optimistic attribution changes, free-form issue selection, bulk relinking, or background polling
  that is independent of known active work.
- Backend schema, route, or generated-contract changes unless implementation discovers a contract
  defect that prevents the accepted requirements; such a defect requires a proposal update.

## Decisions

### 1. Use three primary routes inside one persistent application shell

The route tree will use `/issues` for the overview, `/issues/:issueId` for detail, and `/sessions`
for attribution inspection. `/` redirects to `/issues`. The shell contains product navigation,
density control, and a compact operational-status control that can reveal subsystem detail without
forcing a separate settings route.

Issue and session pages use a fixed initial page size and a one-based `page` search parameter. The
route converts it to the backend's zero-based offset. Invalid or out-of-range syntax normalizes to
the first page; a backend-empty later page offers navigation to the preceding valid page rather
than pretending that all data is absent.

**Alternatives considered:** A single master-detail page was rejected because issue detail would
not be directly linkable and would create cramped responsive behavior. A route for every status
subsystem was rejected because status is supporting context rather than a primary product object.
Keeping pagination only in component or Zustand state was rejected because it breaks bookmarking
and browser history.

### 2. Organize authored code by product feature with a small shared presentation layer

The target layout is:

```text
frontend/src/
├── app/                         shell, providers, route configuration
├── api/                         generated client plus authored endpoint enhancement
├── components/ui/               minimal reusable shadcn/ui primitives
├── features/
│   ├── issues/                  overview, detail, metrics, breakdowns
│   ├── sessions/                session page, attribution state, relink dialog
│   └── operations/              status summary, detail, and manual actions
├── stores/                      display-only Zustand state
└── lib/                         exact formatters and normalized API-error helpers
```

Feature modules own domain-specific components and route composition. Shared UI contains only
generic primitives such as badge, card, table, alert, skeleton, dialog, and pagination. Tests
mirror this hierarchy under `frontend/__tests__`.

**Alternatives considered:** Grouping all components by visual type was rejected because issue,
session, and operational rules would leak into the shell and generic component folders. Creating a
shared abstraction before two real uses was rejected to avoid speculative framework code.

### 3. Enhance, but never edit, the generated RTK Query service

An authored API module will import the generated service and enhance its endpoints with a small tag
model such as issue usage, sessions, import status, Linear status, and cost status. Feature code
will consume hooks from the enhanced service or narrow feature wrappers. Successful rescan, sync,
recalculation, and relink operations invalidate only affected tags; known active runs use bounded
status polling, while idle data does not poll continuously.

Mutations do not optimistically modify attribution or accounting. The server response and later
queries remain authoritative. Existing data remains visible during background refresh, and
mutation errors are normalized into safe user-facing categories without dumping raw payloads.

**Alternatives considered:** Hand-editing generated endpoints was rejected because regeneration
would overwrite behavior and violate the repository contract. Copying query results into Zustand
was rejected because it creates two remote-state authorities. Resetting the entire API cache after
every mutation was rejected because it causes unnecessary loading and hides the dependency between
an action and affected data.

### 4. Keep URL, remote, and display state in separate owners

Issue IDs and pagination belong to React Router. Backend results and request lifecycle belong to
RTK Query. Zustand remains limited to density and future display-only preferences that are neither
shareable navigation nor server state. Confirmation-dialog state stays local to the initiating
feature unless multiple unrelated routes genuinely need it.

**Alternatives considered:** A general Redux slice was rejected because the only global remote
state already has an RTK Query owner. Storing pagination in Zustand was rejected because it would
make copied links and browser navigation surprising. Encoding transient dialog state in the URL
was rejected because confirmations are not durable navigation destinations.

### 5. Render exact strings through dedicated accounting formatters

Count formatting accepts only validated decimal strings and uses `BigInt` or string grouping so it
never passes large integers through `Number`. Cost formatting preserves the server's decimal value,
applies a consistent USD presentation policy, and can reveal the precise source string when a
rounded display is used. Null renders as an unavailable marker, never zero.

A shared metric presentation labels cached input as part of input, displays completeness alongside
known partial values, and maps known sanitized anomaly/pricing codes to concise descriptions while
falling back to a safe humanized code. Daily presentation labels null as `Unknown time` and carries
an explicit non-additive session-count note. Cost-generation metadata is secondary provenance,
not a headline metric.

**Alternatives considered:** Converting every metric with `Number()` was rejected because integer
counts can exceed the safe range. Recomputing total tokens or cost from visible parts was rejected
because null propagation, pricing periods, and partial estimates belong to the backend. Treating
null as zero was rejected because it would convert incomplete accounting into a false claim.

### 6. Prefer tables on wide screens and semantic stacked records on narrow screens

Overview and breakdown collections use semantic tables where column comparison matters. At narrow
widths, CSS changes each record to a labeled stacked layout or permits focused horizontal overflow
without removing columns. Summary metrics use responsive cards. Status, warning, empty, and error
components use text and icons together; color is never the only signal.

Relink replacement uses an accessible alert dialog naming the committed issue and candidate.
Unlinked initial linking can use a lighter confirmation but remains explicit. Buttons disable only
for a concrete reason and expose that reason in adjacent text or accessible description.

**Alternatives considered:** Adding a charting dependency was rejected because the current daily
and model requirements are accurately served by ordered tables and cards. Hiding lower-priority
metrics on mobile was rejected because completeness and anomaly context is essential to honest
accounting. Native `window.confirm` was rejected because it cannot present structured attribution
context consistently or be tested and styled with the rest of the interface.

### 7. Test behavior at three proportional layers

Pure formatter and URL-state tests cover precision, nulls, invalid pagination, and error
normalization. React Testing Library route/feature tests use a real Redux store with mocked network
responses so loading, empty, success, refresh, failure, confirmation, and invalidation behavior are
exercised through generated hooks. Playwright covers only critical cross-route flows: issue list to
detail, finding an unlinked or changed-candidate session and relinking it, and observing/retrying an
operational failure.

**Alternatives considered:** Mocking generated hooks directly was rejected for route-level tests
because it skips cache and request-state behavior. Making every scenario an end-to-end test was
rejected because it would be slow and brittle. Snapshot-heavy component tests were rejected because
they provide weak evidence for accessibility and interaction behavior.

## Risks / Trade-offs

- **[The current list APIs provide pagination but no server-side filtering or sorting]** → Keep the
  first dashboard faithful to deterministic backend pages and do not add misleading current-page
  filters; propose backend query capabilities separately if real usage requires them.
- **[Generic generated operation names such as `list` and `status` reduce clarity]** → Re-export
  narrow feature hooks from an authored enhancement module while keeping the generated file intact.
- **[Status polling could create noisy local traffic]** → Poll only while the corresponding API
  reports active or queued work and stop after terminal or unavailable state.
- **[Several dense metric dimensions can overwhelm the issue detail]** → Lead with issue totals,
  progressively disclose provenance and warnings, and use separate ordered sections for sessions,
  models, and dates.
- **[A relink changes aggregation across multiple screens]** → Avoid optimism and invalidate
  sessions plus issue list/detail only after confirmed success.
- **[Unknown future anomaly codes may appear]** → Render a safe fallback label and the sanitized
  code instead of failing the view or exposing raw diagnostics.
- **[Responsive tables can be difficult for assistive technology]** → Preserve semantic headers
  and labels, test keyboard order and accessible names, and prefer stacked records only where table
  semantics would otherwise become unusable.

## Migration Plan

1. Add the minimal UI primitives, exact formatters, API-error normalization, and authored RTK Query
   endpoint enhancement with focused unit tests.
2. Replace the placeholder shell and add the routed issue overview and issue detail without
   removing the existing health/development boundary.
3. Add the session attribution view and explicit relink confirmation using existing API behavior.
4. Add operational status and manual actions with bounded active-run refresh.
5. Add responsive and accessibility passes, mirrored integration tests, and Playwright critical
   flows; then run the complete frontend and repository verification pipelines.

The change is additive to the frontend and requires no data migration. Rollback restores the prior
frontend bundle; backend APIs and persisted data remain compatible and unchanged.
