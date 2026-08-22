## 1. Compact Token Formatter

- [x] 1.1 Add a token-specific nullable decimal-string formatter that validates non-negative input,
  selects `k`/`m`/`b`/`t` with integer-safe arithmetic, truncates to the agreed precision, and
  returns `Unavailable` for null or malformed values without changing the exact count formatter.
- [x] 1.2 Extend formatter unit tests for exact sub-thousand values, leading zeros, each suffix,
  scaled values below and above 100, omitted `.0`, magnitude-boundary truncation, terminal `t`
  behavior, null and malformed input, and values beyond JavaScript's safe integer range.

## 2. Token Presentation

- [x] 2.1 Use the compact token formatter for input, cached-input, output, and total-token entries in
  the shared issue metric grid and compact metric summary while retaining exact session counts and
  developer turns.
- [x] 2.2 Use the compact token formatter for issue-detail session, model, and daily token columns
  and for the session-detail usage value without changing adjacent non-token formatting.
- [x] 2.3 Add or update representative frontend rendering tests to verify compact token labels,
  unchanged exact non-token counts, and existing unavailable and completeness states.

## 3. Frontend Verification

- [x] 3.1 Run the frontend Bun test suite with `npm run test -w frontend` and resolve regressions.
- [x] 3.2 Run repository formatting and lint checks plus the frontend build with
  `npm run format:check`, `npm run lint`, and `npm run build -w frontend`.
