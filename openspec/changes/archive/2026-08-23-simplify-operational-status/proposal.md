## Why

The operations panel currently combines narrowly triggered background polling with a full dump of
every session-import checkpoint. The polling cannot discover work that starts after an idle status
response, while the checkpoint dump obscures the small amount of information that usually requires
operator attention.

## What Changes

- Remove periodic client polling from operational status.
- Add one explicit refresh action that updates import, Linear, and cost-calculation status together.
- Continue refreshing affected cached data after the user starts an operational action.
- Replace the complete checkpoint listing with a checkpoint count and details only for checkpoints
  that have a non-ready state, unknown records, malformed records, or a sanitized error.
- Preserve unavailable-root details, current and last-run summaries, subsystem actions, loading,
  failure, and accessible status feedback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Replace automatic operational-status polling with explicit refresh behavior and
  require a concise, actionable session-import summary rather than listing healthy checkpoints.

## Impact

- Affects the frontend operations panel, its RTK Query refetch behavior, and frontend regression
  coverage.
- Does not change backend endpoints, generated API contracts, ingestion persistence, or operational
  mutation semantics.
- Does not add server push, background notification delivery, pagination for checkpoints, or a
  separate diagnostics view.
- Has no dependency on the other currently planned OpenSpec changes.
