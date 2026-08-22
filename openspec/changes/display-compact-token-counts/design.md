## Context

See `proposal.md` for motivation and `specs/usage-dashboard/spec.md` for observable behavior. Token
metrics arrive through the generated API as nullable decimal strings. The frontend currently sends
token values, session counts, and developer-turn counts through the same exact count formatter,
which validates the string and groups digits without using JavaScript `Number`.

Token values appear in the shared issue metric grid, compact issue summaries, issue-detail
session/model/day tables, and session details. The change must update all of those presentations
without changing non-token counts or the generated frontend/backend contract.

## Goals / Non-Goals

**Goals:**

- Centralize compact token formatting in one authored frontend utility.
- Produce deterministic lowercase labels using truncation and the specified decimal policy.
- Preserve safe handling of arbitrary-length decimal strings, nulls, and malformed values.
- Keep every existing token presentation consistent while leaving non-token metrics exact.

**Non-Goals:**

- Retaining or revealing the exact token count in an alternate UI affordance.
- Localized compact notation, configurable precision, or a general-purpose quantity formatter.
- Recomputing token totals or changing completeness and anomaly semantics.

## Decisions

### 1. Add a token-specific formatter beside the exact count formatter

Add an authored formatter that accepts a nullable decimal string and returns either a compact token
label or `Unavailable`. Keep the existing exact count formatter unchanged for session counts,
developer turns, and USD internals. Token-rendering call sites will opt into the new formatter.

Updating the existing nullable count formatter was rejected because it would silently abbreviate
non-token metrics. Formatting values in each component was rejected because boundary behavior
would drift between dashboard views.

### 2. Derive compact units with integer-safe arithmetic

Validate tokens as non-negative decimal integers, normalize leading zeros, and perform magnitude
selection and truncation using `BigInt` or equivalent decimal-string arithmetic. Select the largest
applicable divisor from `k` (10^3), `m` (10^6), `b` (10^9), and `t` (10^12); values above the
trillion range continue to use `t` so the formatter remains defined for arbitrary-length inputs.

For a selected unit, calculate the whole scaled value and the first fractional digit without
converting the full count to `Number`. Include the fractional digit only when the whole scaled value
is below 100 and the digit is non-zero. Discard all remaining digits. This produces `1.7m`,
`12.7m`, `990k`, and `1m` for the agreed examples.

`Intl.NumberFormat` compact notation was rejected because it depends on locale and runtime compact
patterns, normally rounds values such as `990,673`, uses presentation casing that does not match the
contract, and requires unsafe conversion for sufficiently large decimal strings. Ordinary floating
point division was rejected for the same precision boundary. Rounding was rejected because a
compact label must not overstate observed usage or cross early into the next magnitude.

### 3. Apply compact formatting only where a value is semantically tokens

Use the token formatter for input, cached-input, output, and total-token fields in metric grids and
for total-token values in compact summaries and detail tables. Continue using exact count formatting
for session counts and developer turns even where they sit beside token values.

Changing API response types or returning preformatted labels from the backend was rejected because
compact notation is a client presentation concern and would couple the API to one UI policy.

### 4. Verify the formatter contract and representative render paths

Unit tests will cover null and malformed input, leading zeros, values below 1,000, each magnitude,
the 10/100 scaled boundaries, omitted `.0`, truncation near the next magnitude, and counts beyond
`Number.MAX_SAFE_INTEGER`. Existing or focused feature tests will assert that token fields use the
compact formatter while session and developer-turn counts remain exact.

Snapshot-only coverage was rejected because explicit input/output assertions document the compact
boundary contract more clearly and fail closer to the source of a regression.

## Risks / Trade-offs

- **[Compact labels intentionally hide exact usage]** → Keep this limitation explicit in the
  capability contract; exact-value affordances remain a separate future change.
- **[Truncation can make nearby values look identical]** → Accept the reduced precision in exchange
  for scanability and consistently avoid overstating usage.
- **[A token call site could retain exact formatting]** → Search all authored frontend token fields
  during implementation and add representative rendering assertions.
- **[Values above 999 trillion produce large `t` labels]** → Keep `t` as the terminal unit rather
  than introducing ambiguous non-standard suffixes; the integer-safe implementation remains valid.

## Migration Plan

1. Add and test the token-specific formatter without changing the existing count formatter.
2. Switch all authored token-rendering call sites to the new formatter and run focused frontend
   tests, type checking, linting, and build verification.
3. Deploy as a frontend bundle update; no data or API migration is required.

Rollback restores the previous frontend formatter calls. Backend responses and persisted values
remain compatible throughout.
