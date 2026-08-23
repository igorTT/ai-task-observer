## Why

Session pages always label cost as a partial estimate because the frontend constructs cost state
with hardcoded unavailable values, even when every usage observation has been priced completely.
The session API needs to expose the persisted calculation result so the UI can present trustworthy
cost status instead of a placeholder.

## What Changes

- Add session-level estimated cost, cost completeness, and pricing-gap codes to session list and
  detail responses, derived from the latest completed cost-calculation generation.
- Preserve complete, partial, and unavailable cost states using the established pricing semantics.
- Replace the session page's hardcoded cost state with the generated API response fields.
- Regenerate and commit the OpenAPI routes/specification and frontend RTK Query client.
- Add backend and frontend regression coverage for complete, partial, and unavailable estimates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-session-ingestion`: Extend session summaries and details with calculated cost state from
  the latest completed generation.

## Non-goals

- Changing pricing rates, model aliases, token normalization, or cost-calculation formulas.
- Displaying billed spend or presenting API-equivalent estimates as invoices.
- Adding per-model cost breakdowns to the standalone session page.
- Changing issue, model, daily, or overview-chart aggregation behavior.

## Dependencies

- Depends on the existing `session-cost-estimation` generation and partial-estimate semantics.
- Reuses the existing generated OpenAPI boundary; no new runtime dependency or database migration
  is required.

## Impact

- Backend session response models, query service, and DuckDB repository reads.
- Generated tsoa routes/OpenAPI output and frontend RTK Query types.
- Session list/detail API consumers receive three additive response fields.
- Frontend session-page cost-state rendering and matching backend/frontend tests.

