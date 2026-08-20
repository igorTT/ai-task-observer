## Context

This change consumes the model- and time-aware normalized observations introduced by
`persist-session-usage-events`. Pricing must remain versioned application configuration rather
than database-managed catalog data, yet historical estimates need enough persisted provenance to
survive later configuration edits. DuckDB remains single-writer and Node.js performs runtime work;
Bun remains test-only.

## Goals / Non-Goals

**Goals:**

- Produce deterministic decimal USD estimates for every priceable observation component.
- Make configuration errors fail early while treating runtime unknown models as ordinary incomplete
  data.
- Retain auditable historical generations and exact applied rates.
- Provide a coalesced backend recalculation operation without coupling it to Linear or the UI.

**Non-Goals:**

- Claiming correspondence with invoices, subscriptions, credits, or negotiated billing.
- Fetching current pricing or model lists from a network service.
- Storing the model catalog as mutable database entities.
- Aggregating by Linear issue, date, or phase.

## Decisions

### 1. Use a strict versioned JSON catalog with decimal-string rates

The default file is application-owned at `backend/config/models.json`; a validated startup setting
may override its path for local deployments. The initial shape is:

```json
{
  "schemaVersion": 1,
  "catalogVersion": "2026-08-19",
  "currency": "USD",
  "tokenUnit": 1000000,
  "models": [
    {
      "id": "canonical-model-id",
      "aliases": ["exact-source-model-name"],
      "prices": [
        {
          "effectiveFrom": "2026-01-01T00:00:00Z",
          "effectiveTo": null,
          "uncachedInputUsdPerUnit": "1.25",
          "cachedInputUsdPerUnit": "0.125",
          "outputUsdPerUnit": "10.00"
        }
      ]
    }
  ]
}
```

`schemaVersion` controls parser compatibility; `catalogVersion` is a human-readable release ID.
Canonical IDs resolve themselves. Aliases are globally unique exact strings and never use case
folding or prefix matching. Price intervals are half-open `[effectiveFrom, effectiveTo)` in UTC and
must not overlap for one model. Decimal strings avoid binary floating-point ambiguity.

Alternative: use model and price tables editable in DuckDB. Rejected because configuration is the
declared source of truth and local mutations would make deployments irreproducible.

Alternative: copy current public pricing into code constants. Rejected because aliases, effective
dates, and config revisions need independent versioning.

### 2. Validate the entire catalog before opening the listener

The startup configuration boundary reads bytes once, hashes those exact bytes with SHA-256, parses
the supported schema, and validates all identities, intervals, and non-negative decimal rates.
Errors name the file and invariant but do not print its contents. An invalid configured catalog is
an operator error and prevents startup; an unknown model observed later is data and does not affect
health.

Alternative: skip bad entries and start partially. Rejected because whether a model is priceable
would depend on silent configuration damage.

### 3. Resolve each observation independently

The calculator maps the observation's exact source model to a canonical model and selects the price
period using the observation UTC timestamp. Unknown model, unknown timestamp, or a pricing gap
produces no guessed rate. Multiple models or periods within one session remain separate line items
and are summed only after pricing.

This intentionally does not fall back to session model, import time, or the latest price; those
choices would rewrite history.

### 4. Calculate with fixed decimal arithmetic and component provenance

Token counts remain integers. Rates and results use DuckDB `DECIMAL` columns and a TypeScript
decimal representation that never converts through JavaScript `number`. For component `c`:

```text
component_cost_usd = token_count[c] * rate_usd_per_unit[c] / token_unit
```

The persisted value retains sufficient scale for exact recomputation; HTTP values are normalized
decimal strings. Rounding for display belongs to the later UI, not the accounting service.

If cached/uncached input is unknown, their cost components are null even when total input is known.
An independently valid output component can still be priced. A generation/session has
`costComplete = true` only when every contributing component is valid and priced.

Alternative: price all input at the uncached rate when cached data is invalid. Rejected because it
creates an undocumented upper estimate and no longer represents the configured facts.

### 5. Persist global immutable calculation generations

Add repository-owned tables for:

- `cost_calculation_generations`: identity, source-fact revision, status, config schema/catalog
  version, config SHA-256, calculator version, token unit, start/completion time, and sanitized
  failure category.
- `cost_calculation_items`: generation and observation identity, canonical/observed model, selected
  period, exact rates, component token counts/costs, total known cost, completeness, and gap/anomaly
  codes.

A generation evaluates a stable committed observation snapshot inside the backend's serialized
write coordination. Items and completed status commit atomically. Readers select the newest
completed generation only; failed or running generations never shadow it. Persisting exact rates
and line inputs is sufficient reproduction evidence without copying the whole JSON file into each
row.

Alternative: overwrite one cost column on each session. Rejected because recalculation would erase
which prices produced historical values.

Alternative: store only config hash with no rates. Rejected because the referenced file may no
longer exist and a hash cannot explain the amount.

### 6. Coalesce calculation triggers

Startup ensures a completed generation exists for the current fact revision/config/calculator
tuple. New committed observations schedule a debounced generation; repeated triggers coalesce.
An authored local operation exposes status and explicit recalculation, for example
`GET /api/costs/status` and `POST /api/costs/recalculate`. Recalculation never edits usage facts or
calls Linear. A request during an active run returns the active or queued generation state instead
of creating a competing writer.

Generated tsoa/OpenAPI artifacts are regenerated normally; no frontend screen is implemented.

## Risks / Trade-offs

- [A global generation becomes expensive as history grows] → Start with the transparent POC model,
  index observation/generation joins, coalesce triggers, and preserve the option for revision-aware
  incremental generations later without changing the response semantics.
- [Decimal scale can truncate very small components] → Choose and test a documented high-precision
  DuckDB decimal scale and retain exact rates/counts for reproduction.
- [Config edit invalidates startup] → Ship a validated default fixture and precise sanitized error;
  fail-fast prevents silently wrong estimates.
- [Unknown time makes a known model unpriceable] → Keep the token facts and explicit gap rather than
  borrowing a current rate.
- [Latest completed generation can briefly lag new imports] → Issue aggregation will expose
  `costComplete: false` for facts not covered by that generation.

## Migration Plan

1. Add the default validated JSON catalog and startup path validation.
2. Add generation/item tables and passive models without changing session token data.
3. Implement calculation and create the first full generation from committed observations.
4. Enable coalesced import/startup triggers and local status/recalculation operations.
5. Regenerate API artifacts and verify historical generations remain queryable after a test catalog
   change.

Rollback stops new calculation triggers and restores the prior API surface. Additive generation
tables can remain for audit or be removed by a later explicit migration; source usage facts are
unchanged.
