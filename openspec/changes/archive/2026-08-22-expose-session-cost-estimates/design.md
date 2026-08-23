## Context

See `proposal.md` for motivation and the delta specification for observable behavior. The session
query currently reads persisted session metadata and normalized token totals, while calculated
costs live as immutable observation items keyed to a calculation generation. The issue-usage path
already demonstrates the required latest-completed-generation, uncovered-observation, decimal,
and pricing-gap semantics, but it is limited to sessions linked to an issue. Standalone session
responses must also work for unlinked sessions and must continue to cross the generated OpenAPI
boundary.

## Goals / Non-Goals

**Goals:**

- Produce one trustworthy cost projection for every requested session from current observations
  and the latest completed cost generation.
- Keep list-page lookup bounded by querying costs for the page as a batch.
- Use the same decimal serialization, completeness, gap de-duplication, and
  `uncovered_generation` semantics as issue usage.
- Keep DuckDB access read-only for this projection and preserve the backend as its sole owner.

**Non-Goals:**

- Persisting a second mutable session-cost total or changing calculation generations.
- Adding a standalone per-observation or per-model cost API.
- Refactoring all issue-usage aggregation as part of this fix.

## Decisions

### Add a read-only session cost projection repository

Introduce a repository query that accepts the requested session identifiers and returns a keyed
session cost summary. It will select the latest completed generation deterministically, join every
current normalized observation to its item in that generation by observation identity, and group
the result by session.

The projection will:

- sum non-null known cost components without converting through floating point;
- mark cost complete only when usage exists, every current observation is covered, and every
  covered item is complete;
- merge and sort distinct item pricing-gap codes; and
- add `uncovered_generation` whenever current observations lack matching items, including when no
  completed generation exists.

Sessions without priceable components return a null estimate and false completeness. Sessions
without observed usage also return null and false, without manufacturing a pricing gap.

Alternative: derive cost from the issue-usage repository. Rejected because that repository starts
from committed issue links and cannot represent unlinked sessions.

Alternative: persist cost fields in `codex_session_usage`. Rejected because immutable calculation
generations are the source of truth; duplicating totals would introduce invalidation and
single-writer coordination work.

### Batch list reads and use the same projection for detail

The session list query will load the page's session records, obtain cost summaries for those IDs in
one repository call, and combine them with existing token and attribution data. Session detail will
call the same projection with one identifier. This avoids adding another per-row database query to
the existing list path and guarantees list/detail agreement.

Alternative: issue one cost query from each session view. Rejected because it adds avoidable N+1
work and makes list performance scale with the page size.

### Extend the authored response and regenerate clients

Add required `estimatedCostUsd: string | null`, `costComplete: boolean`, and
`pricingGapCodes: readonly string[]` fields to the authored session response model. Run the root API
generation command so tsoa routes, OpenAPI, and the RTK Query client change together. These are
additive JSON fields, although typed test fixtures and consumers must be updated because the
authored contract treats them as required.

Alternative: define frontend-only optional fields with fallbacks. Rejected because it would allow
the placeholder bug to recur and weaken the server contract.

### Render server-owned state on the session page

Display the generated session response's estimate alongside the existing session facts and pass
its completeness and gap codes to the existing metric-state component. The frontend will format
the decimal estimate but will not infer completeness from the presence of a value. A null estimate
remains distinct from numeric zero.

Alternative: hide the cost badge on session pages. Rejected because valid calculated session cost
already exists and the intended fix is to expose it accurately.

## Risks / Trade-offs

- [Session and issue aggregation semantics could drift] → Reuse the established decimal parser and
  gap-merging behavior where practical, and assert equivalent complete, partial, missing-generation,
  and uncovered-generation fixtures in repository tests.
- [A calculation can complete between separate metadata and cost reads] → Each cost query chooses
  one latest completed generation internally; the response is coherent for that projection even if
  a later request observes a newer generation.
- [Large session pages could create oversized identifier filters] → Batch only the already bounded
  page of IDs and retain the existing pagination limit.
- [Required generated fields break stale test fixtures at compile time] → Regenerate all API
  artifacts together and update authored fixtures in the same change.

## Migration Plan

1. Add and verify the read-only projection and backend response fields.
2. Regenerate all API artifacts using the root generation command.
3. Update the session page and tests to consume the generated fields.
4. Deploy backend and bundled frontend together; no database migration or backfill is required.

Rollback consists of reverting the frontend, generated artifacts, response fields, and projection
code together. Persisted session and calculation data remain unchanged.
