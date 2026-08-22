## Why

Exact token totals such as `990,673` are visually noisy in dashboard summaries and tables. Compact,
predictable labels will make usage easier to scan while preserving unavailable and completeness
states.

## What Changes

- Display token counts below one thousand exactly and abbreviate larger values with lowercase
  magnitude suffixes such as `k`, `m`, `b`, and `t`.
- Retain one non-zero truncated decimal digit when the scaled token value is below 100, so values
  such as `1,700,000` and `12,700,000` display as `1.7m` and `12.7m`; omit a trailing `.0` and use
  whole scaled values at 100 or above, so `990,673` displays as `990k`.
- Apply compact formatting only to token metrics. Session counts, developer turns, USD values,
  unavailable markers, and completeness or anomaly states keep their existing presentation.
- Add focused frontend formatter and rendering coverage for exact, compact, boundary, null, and
  invalid values.
- Dependencies: the existing `usage-dashboard` capability and its generated decimal-string token
  fields.
- Non-goals: backend or API contract changes, generated-client edits, accounting recomputation,
  compact formatting for non-token counts, tooltips or drill-downs for exact token values, and
  localization of suffixes or decimal separators.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Change the required presentation of token metrics from exact grouped counts
  to compact, non-overstating labels while retaining honest null and completeness behavior.

## Impact

- Authored frontend formatter and token-rendering call sites under `frontend/src`.
- Mirrored frontend tests under `frontend/__tests__`.
- No backend, OpenAPI, generated client, persistence, dependency, or deployment changes.
