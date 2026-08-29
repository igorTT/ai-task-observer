## Context

See [proposal.md](proposal.md) for motivation. The in-progress
`filter-usage-overview-by-session-phase` change adds one optional current-session-phase predicate to
`GET /api/usage/timeline`. A filtered response currently contains only the selected population's
totals and hourly buckets, so the frontend cannot recover the all-phase denominator or the other
phase amounts.

The timeline repository already reads known-time observations for one captured 12h or 24h window,
joins the current `session_phase_assignments` row and latest completed cost-generation items, then
derives exact totals and buckets in TypeScript. The API carries counts and USD values as decimal
strings; the frontend converts values to JavaScript numbers only for Recharts geometry. The
canonical phase order is Research, Explore, Proposal, Apply, Verify, Quick flow, Other, followed by
the reporting-only Unassigned population.

## Goals / Non-Goals

**Goals:**

- Produce the filtered timeline and all-phase comparison from one classified fact snapshot.
- Keep one backend-authoritative all-phase denominator and exact amount for every phase population.
- Make partial, unavailable, known-zero, and selected-zero comparisons visually and accessibly
  distinct.
- Add a bounded response shape and reuse the existing generated API and cache lifecycle.

**Non-Goals:**

- Generalize the timeline into arbitrary dimensions or return phase-specific hourly series.
- Use frontend requests or arithmetic to reconstruct accounting totals.
- Add a charting dependency, persist aggregates, or change phase assignment storage.
- Treat the donut as evidence of billed cost; values remain configured API-equivalent estimates.

## Decisions

### 1. Add a cost-only comparison object to the existing timeline response

Add a required `phaseCostComparison` object with:

- `totals`: `estimatedCostUsd`, `costComplete`, cost completeness state, and warnings for the
  unfiltered known-time range population;
- `phases`: exactly eight entries with the same cost fields and a `sessionPhase` discriminator in
  canonical order, with Unassigned last.

The existing top-level `totals`, `buckets`, and `sessionPhase` retain their selected-filter meaning.
When a phase is selected, its top-level estimated cost and completeness must equal the matching
comparison entry; when All is selected, the top-level cost must equal comparison `totals`. Keeping
the comparison required gives generated clients one stable shape and makes zero-usage categories
explicit rather than absent.

The response does not carry a percentage. The backend remains authoritative for exact dollar
amounts and the denominator; the frontend derives a rounded display share and chart angles from
those values. A server-supplied percentage was rejected because it would add scale and rounding
policy to the accounting contract without improving exact cost reconciliation.

A separate `/api/usage/by-phase` resource was rejected because the overview would need two requests
with potentially different cutoffs, generation status, loading state, and failure behavior.
Issuing one filtered request per phase was rejected for the same consistency reason and because it
would multiply database and cache work.

### 2. Read the range population once, classify it once, and derive both views

Change the known-time fact query to return every observation in the captured range with a reporting
phase discriminator obtained from the direct assignment join: the stored canonical phase, or
`unassigned` when the join has no row. Do not apply the selected phase predicate in SQL. The
repository then:

1. derives the selected fact collection for existing totals and hourly buckets;
2. calculates the comparison total from all returned facts; and
3. calculates one cost projection for each value in the stable phase order.

The comparison cost projection reuses the existing metric calculation and projects only its cost
amount, cost completeness, derived completeness state, and warnings. This preserves generation
coverage and known-partial rules without creating a second accounting implementation. Empty phase
collections therefore produce complete zero values; a non-empty collection with no known cost
produces null and unavailable state.

Fetching all range facts even for a selected phase is intentional: comparison requires the global
population, the range is capped at 24 hours, and one fact query keeps the filtered amount and its
comparison entry internally consistent. A SQL `GROUP BY` plus a separate selected-fact query was
rejected because it duplicates completeness and warning aggregation, reads the same range twice,
and can drift from bucket semantics. Persisted phase aggregates were rejected because current
assignment intentionally reclassifies historical session usage and would introduce invalidation or
rebuild complexity.

The existing selected-phase unknown-time count remains separate and is not included in the range
comparison because observations without a timestamp cannot belong to a 12h or 24h window.

### 3. Treat known partial cost as a partial distribution, never as complete spend

When at least one estimated-cost component is known, the donut uses those known phase amounts and
labels the result "Known estimated cost" if the comparison total or any phase is incomplete. A null
phase amount produces no arc and remains explicitly Unavailable in the accessible phase list. If
the comparison total is null, the card renders an unavailable state instead of a donut. If the
authoritative total is complete zero, it renders a successful no-cost state; it does not fabricate
equal or minimum-size slices.

The donut never sums displayed phase strings to establish `$xx`; it displays the backend `totals`
amount. The phase values should reconcile by construction, but the separate denominator protects
the contract from browser decimal arithmetic and future server-side aggregate changes.

Hiding the entire chart whenever any phase is partial was rejected because it would discard useful
known estimates. Rendering null values as zero was rejected because it would visually claim that
unpriced usage had no cost.

### 4. Use the selected phase only as presentation emphasis

Add a cost-comparison card after the counters and before the existing hourly charts. Reuse Recharts
`PieChart`, `Pie`, `Cell`, `Tooltip`, and `ResponsiveContainer` with a stable, contrast-conscious
color per comparison phase. With All selected, the center shows the authoritative all-phase amount.
With one phase selected, the center shows its amount and "of $xx", its arc has a stronger border or
radius, and non-selected arcs remain visible so comparison context is preserved. Text labels and an
explicit Selected marker ensure the state is not communicated by color alone.

Chart geometry and rounded percentage display may use guarded finite-number conversions, but exact
dollar text always comes from the response decimal strings and existing USD formatter. A zero
selected entry shows a 0% share and no synthetic arc. A complete-zero total shows no percentage
distribution.

The SVG is supplementary and can be hidden from assistive technology. An ordered adjacent phase
list exposes phase label, exact amount, rounded share, completeness state, and selected state; the
card heading and description identify the rolling range and current-assignment semantics. This is
more reliable than attempting keyboard focus on generated SVG sectors and also gives zero or null
phases a representation.

### 5. Reuse timeline cache and refresh behavior

The comparison travels with each existing `{ range, sessionPhase }` timeline cache entry, so range
or phase navigation updates counters, bars, and donut atomically. No new query hook or cache tag is
introduced. The dependency change already invalidates every subscribed UsageTimeline query after a
successful phase mutation; those refetches will also refresh comparison data. Cached-data refresh
failures continue to use the overview's existing retained-data alert and retry path.

Authored tsoa models are changed first, followed by root API generation. Generated backend routes,
OpenAPI, and the RTK Query client are never edited by hand.

## Risks / Trade-offs

- [A selected request now loads all known-time range facts] → Keep the comparison to fixed 12h/24h
  windows, use one ordered query, retain focused proportional repository coverage, and profile
  before introducing duplicate SQL aggregation.
- [Partial values can be mistaken for a complete allocation] → Label the center and list as known
  estimated cost, retain completeness badges and warnings, and do not draw null amounts.
- [Similar phase colors or tiny slices can be hard to distinguish] → Pair color with ordered text,
  exact values, shares, and a Selected marker; do not require sector interaction.
- [JavaScript numbers can round exact decimal strings] → Restrict conversion to geometry and
  rounded shares; never derive or display authoritative dollar totals from plotted numbers.
- [The follow-on is implemented before its dependency is stable] → Apply only after
  `filter-usage-overview-by-session-phase` is complete and verified, then build on its generated
  contract and URL/cache behavior.

## Migration Plan

1. Complete and verify `filter-usage-overview-by-session-phase`.
2. Extend the timeline fact/domain aggregation and authored response models with the required
   comparison object.
3. Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client through
   `npm run generate:api`.
4. Add the comparison presentation helper, donut card, styling, and accessible phase list.
5. Verify exactness, phase reclassification, partial/unavailable/zero states, selected emphasis,
   range changes, cached refresh, and generated boundaries.

No database migration or backfill is required. Rollback removes the response fields and donut UI;
usage observations, cost generations, and current phase assignments remain unchanged.
