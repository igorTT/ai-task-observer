## Context

See `proposal.md` for motivation and the two delta specs for observable behavior. The current
frontend redirects `/` to `/issues`, and issue aggregation intentionally starts from committed
Linear links. Recent global consumption instead needs to start from committed usage observations
so unlinked sessions are not silently omitted. Token facts remain queryable without pricing, while
cost comes from an immutable latest completed generation whose coverage may be current, stale, or
missing.

The existing API already represents counts and fixed-decimal USD as strings, propagates separate
token and cost completeness, and treats the backend as the sole DuckDB owner. The new charts must
preserve those semantics while supplying finite numeric geometry to a visualization library.

## Goals / Non-Goals

**Goals:**

- Add one coherent global overview whose counters and charts share an exact cutoff, selected range,
  bucket sequence, and pricing generation.
- Keep time-window membership, aggregation, zero filling, completeness, and generation provenance
  authoritative in the backend.
- Make `12h` the canonical default while keeping range state shareable and reversible through
  browser history.
- Introduce Recharts behind a small feature presentation boundary that can later accept daily
  buckets without changing current accounting semantics.
- Keep exact values and accessible bucket data available even though SVG geometry uses JavaScript
  numbers.

**Non-Goals:**

- Building a generic query language, analytics framework, or reusable chart design system.
- Pre-aggregating or persisting timeline buckets, introducing a frontend DuckDB reader, or adding a
  second database writer.
- Choosing calendar-week, calendar-month, or client-zone daily-boundary semantics before those
  ranges are proposed.
- Refactoring the existing linked-issue repository into a global aggregation abstraction.

## Decisions

### 1. Give global consumption a dedicated `/overview` route

Add `Overview` as the first primary navigation destination, redirect `/` to `/overview`, and point
the product brand to it. Keep `/issues`, `/issues/:issueId`, and `/sessions` unchanged. The overview
owns only global counters, range selection, charts, provenance, and request states; issue cards
remain on the linked-issue route.

This avoids placing all-imported totals above a list whose population deliberately excludes
unlinked sessions. It also creates a stable home for later week/month presets without making the
issue page a mixed-scope dashboard.

**Alternatives considered:** Keeping the charts above `/issues` was rejected because identical
visual proximity would imply that global totals equal the linked-issue rows. Replacing `/issues`
with the overview was rejected because issue navigation and pagination remain a primary workflow.

### 2. Use one generated timeline resource for counters and both charts

Add a read-only operation conceptually shaped as:

```text
GET /api/usage/timeline?range=12h|24h

range, bucketUnit, startAt, endAt
totals { totalTokens, estimatedCostUsd, tokenComplete, costComplete, warnings }
buckets[] { startAt, endAt, totalTokens, estimatedCostUsd, completeness, warnings }
unknownTimeObservationCount
costCoverage
latestCompletedCostGeneration
```

The query service captures one clock instant, resolves the supported range definition, and selects
one latest completed cost-generation identity and coverage snapshot. It passes the exact cutoff and
generation ID into a read-only repository query so token totals, cost totals, and bucket values
cannot drift to different windows or generations. The controller validates only the two supported
range values and defaults an omitted value to `12h`.

Use authored response models with decimal strings, then regenerate tsoa routes/OpenAPI and the
frontend RTK Query client through the root generation command. Enhance the generated endpoint with
a `UsageTimeline` cache tag rather than editing generated files.

**Alternatives considered:** Separate token, cost, and total endpoints were rejected because they
could capture different end times or generations and would multiply loading and failure states.
Returning only sparse buckets and filling gaps in the browser was rejected because the backend
must define the authoritative time domain. Reusing the issue-usage endpoint was rejected because
its linked-session population is intentionally different.

### 3. Aggregate from observations and left join one selected cost generation

The new repository query begins with `codex_usage_observations`, filters known `event_time` values
to the selected half-open range, and left joins `cost_calculation_items` by observation ID for the
generation selected by the query service. It does not join Linear attribution tables. This keeps
tokens available when pricing is missing and makes an uncovered observation visible as incomplete
cost rather than dropping it.

Generate UTC-hour boundaries for the selected interval, clip the first and last to the exact range,
and left join facts into every bucket. An injected backend clock makes range and boundary tests
deterministic. Empty buckets and an entirely empty range produce known zero values; observations
without a valid time are counted separately and never assigned a synthetic instant.

Use the established aggregate rules: a token total is null if any contributing normalized total is
unknown; known cost components sum to a partial estimate with false completeness; no priceable cost
is null when usage exists. Global generation coverage and selected-range cost completeness remain
separate signals because a globally stale generation can still cover some or all facts in the
selected interval.

**Alternatives considered:** Reading only `cost_calculation_items` was rejected because the token
chart would disappear without a completed generation and stale generations would hide uncovered
facts. Persisted rollup tables were rejected because 12/24-hour local queries over current facts do
not justify migration, invalidation, and revision complexity. Assigning unknown-time observations
to import or session time was rejected because it would change established accounting semantics.

### 4. Model range presets explicitly and keep the default canonical

Represent supported ranges in one backend definition keyed by `12h` and `24h`, each currently
mapping to an exact duration and hourly bucket unit. The API returns the resolved range and bucket
unit; the frontend does not infer bucket behavior. Future `7d` and `30d` work can extend the enum and
map those presets to daily buckets after their boundary semantics are specified.

On `/overview`, absence of `range` means `12h`. Selecting `24 hours` pushes
`?range=24h`; selecting `12 hours` removes the parameter. An invalid value is canonicalized to the
parameter-free default with history replacement. A labeled radio-style segmented control reads
directly from URL state, so no Zustand or duplicate Redux slice is introduced.

**Alternatives considered:** Persisting the choice in Zustand or local storage was rejected because
it would make copied URLs and browser navigation surprising. Keeping `?range=12h` in every default
URL was rejected as redundant. Accepting arbitrary duration and bucket parameters was rejected
because it creates validation and performance promises not needed by this change.

### 5. Render two synchronized Recharts bar charts from one bucket array

Add Recharts to the frontend workspace and render separate total-token and estimated-cost bar
charts using the same ordered bucket array, x-domain, and synchronization ID. Bar charts express
discrete bucket consumption more accurately than a continuous line or filled area. Responsive
sizing stays within the dashboard's existing desktop support contract.

Each presentation datum retains the raw decimal strings and derives validated finite numbers only
for SVG geometry. Counters, tooltips, accessible descriptions, and warning text always use the raw
values and existing exact formatters. Precision loss in a plotted coordinate therefore cannot
change an accounting claim. If a validated value cannot become finite, the chart marks that point
unplottable while retaining its exact textual value rather than crashing or substituting zero.

Use client-local formatting for bucket interval instants and keep UTC boundaries as an internal API
rule. Disable or reduce animation when the user's reduced-motion preference requests it. Partial or
unavailable points receive a non-color-only warning treatment and explanatory tooltip content.

**Alternatives considered:** A stacked token chart was rejected because cached input is a subset of
input and a trustworthy stack would require a new mutually exclusive category contract. A line or
area chart was rejected because it suggests a continuous rate between discrete aggregates.
Computing exact totals from Recharts data was rejected because browser rounding and incomplete
bucket propagation are not authoritative accounting operations.

### 6. Pair chart interaction with an exact accessible data representation

Use Recharts' accessibility support and synchronized tooltip behavior, but do not rely on an SVG
tooltip as the only representation. Give each figure an explicit title and description and expose
one screen-reader-accessible table containing ordered bucket intervals, exact tokens, exact cost,
and completeness. The selector uses native radio semantics with a visible selected state and
keyboard operation. Counter and coverage changes use existing status and warning patterns.

**Alternatives considered:** Pointer-only tooltips were rejected because they do not satisfy the
existing keyboard and assistive-technology contract. A permanently visible data table was rejected
for this focused overview because it duplicates two simple charts at supported desktop sizes; the
underlying accessible table leaves a future visible-data toggle possible.

### 7. Refresh timeline data at committed-work boundaries

Add `UsageTimeline` invalidation to rescan and cost-recalculation mutations. Because those mutations
can finish asynchronously after their accepted response, the overview also observes the existing
bounded import and cost-status polling and refetches the timeline when active work transitions to a
terminal state. Range changes use normal RTK Query argument caching, keep prior selected-range data
visible during refresh where available, and do not introduce idle polling.

**Alternatives considered:** Continuous timeline polling was rejected as unnecessary local traffic.
Refetching only when a mutation is accepted was rejected because it can occur before newly imported
facts or a new cost generation commit.

## Risks / Trade-offs

- **[The exact rolling interval can produce 13 or 25 clock-aligned buckets]** → Label the selector
  as a duration, return explicit bucket boundaries, and test clipped first and last intervals rather
  than implying one bar per nominal hour.
- **[Unknown-time observations cannot be classified into a rolling range]** → Exclude them without
  a fallback and expose a separate count and explanation.
- **[A stale generation can make cost bars partial while token bars are current]** → Keep the charts
  independent, display range completeness and global generation coverage, and refresh after cost
  work completes.
- **[Recharts receives approximate numeric geometry]** → Preserve raw strings for every textual
  claim and test conversion failure independently from exact counters and accessible data.
- **[Responsive SVG sizing is sensitive to zero-sized test containers]** → Give chart cards an
  explicit supported-desktop height and test feature behavior with deterministic container sizing
  rather than brittle SVG snapshots.
- **[Two synchronized charts and an accessible table duplicate bucket presentation]** → Build one
  presentation-data adapter shared by both charts and the table so labels, values, and warnings
  cannot diverge.
- **[Global unknown-time count is not itself range-scoped]** → Label it explicitly as unplaced
  usage and never add it to the selected totals.

## Migration Plan

1. Add the authored backend timeline contract and query path without changing persisted schema.
2. Regenerate and verify backend routes/OpenAPI and the frontend client.
3. Add the Recharts dependency and overview route behind the new generated query.
4. Change the root and brand destinations to `/overview` only after the route is covered by tests.
5. Deploy additively; existing issue and session URLs and stored data remain compatible.

Rollback restores the prior frontend routes and removes the additive timeline endpoint and
Recharts dependency. No data rollback or database migration is required.
