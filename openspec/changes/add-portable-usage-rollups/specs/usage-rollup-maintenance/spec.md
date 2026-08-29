## Purpose

Provides rebuildable, database-portable derived usage summaries so long-range reports stay fast
without making phase assignment or future database migration part of the raw usage model.

## ADDED Requirements

### Requirement: Source-faithful derived usage

The system SHALL maintain derived usage summaries from committed normalized observations and the
selected completed cost generation. Derived summaries SHALL be rebuildable without changing or
deleting raw observations or completed cost generations.

#### Scenario: A committed observation becomes eligible for rollup

- **WHEN** a usage observation is committed with a known event timestamp
- **THEN** the corresponding session time bucket SHALL eventually include its token and cost
  contribution with the same completeness and warning semantics as a raw aggregation

#### Scenario: Rollup rebuilding fails

- **WHEN** derived-summary maintenance fails for a bucket
- **THEN** raw observations and completed cost generations SHALL remain available and the system
  SHALL retry or fall back to source facts rather than silently omitting the bucket

### Requirement: Non-blocking derived-summary maintenance

Derived-summary maintenance SHALL be allowed to run asynchronously and SHALL NOT make committed
session ingestion or a completed cost generation depend on a successful rollup write. A timeline
request SHALL remain complete and trustworthy while maintenance is catching up.

#### Scenario: Timeline is requested while a bucket is pending

- **WHEN** a committed observation has not yet been incorporated into its derived bucket
- **THEN** the timeline SHALL include the observation through a source-fact fallback or an
  equivalent reconciliation path and SHALL NOT return a silently incomplete result

#### Scenario: Maintenance catches up after a pending request

- **WHEN** the pending bucket is successfully rebuilt
- **THEN** later timeline requests SHALL use the derived value and return the same totals, buckets,
  completeness, and warnings as the fallback result

### Requirement: Phase-independent rollups

Derived usage summaries SHALL remain valid independently of the current session phase. Current
phase assignment SHALL be applied when a filtered timeline is produced, so phase changes SHALL not
require rewriting historical usage summaries.

#### Scenario: Session phase is assigned or replaced

- **WHEN** a session is assigned `apply` or its phase is replaced with `verify`
- **THEN** its existing usage SHALL move between filtered results according to the new phase while
  unfiltered totals remain unchanged

#### Scenario: Session phase is cleared

- **WHEN** a session's explicit phase is cleared
- **THEN** its usage SHALL contribute to the `unassigned` result without changing raw usage facts

### Requirement: Cost-generation consistency

Derived cost values SHALL identify the completed cost generation from which they were calculated.
While a newer generation is incomplete, the system SHALL preserve the prior completed generation's
values and expose the same stale or partial coverage semantics as source-fact aggregation.

#### Scenario: A new cost generation completes

- **WHEN** a newer cost generation completes successfully
- **THEN** affected derived summaries SHALL eventually reflect that generation without mutating
  the prior generation or mixing values from both generations

#### Scenario: A cost generation fails

- **WHEN** a requested cost generation fails
- **THEN** derived summaries SHALL continue to use the previous completed generation and SHALL
  preserve the existing failed-calculation behavior
