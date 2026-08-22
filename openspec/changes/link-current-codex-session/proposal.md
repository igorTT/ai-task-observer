## Why

Linking the current Codex session should be a direct, explicit operation: the caller already knows
the current session and the Linear ticket it belongs to. Requiring a renamed title, a separate
inspection phase, and client-side state reconciliation adds ceremony without improving the
backend's ability to validate and atomically persist the link.

## What Changes

- Change `POST /api/sessions/{sessionId}/relink` to require an explicit Linear
  `issueIdentifier` in its request body.
- Make the repository-scoped `$link-current-session` skill accept the ticket identifier and use
  the stable current Codex session identifier supplied by the host.
- Have the skill make one observer API mutation with those two logical inputs and report the
  bounded API result.
- Keep exact Linear resolution, identifier matching, failure preservation, and atomic link
  replacement in the observer backend.
- Treat the explicit invocation and supplied ticket identifier as authorization to establish or
  replace the current link; do not require a second confirmation.
- Remove the skill-side inspect/commit protocol, title parsing, ingestion polling and rescanning,
  stale-title checks, runtime response validators, and custom outcome state machine.
- Preserve existing automatic title-derived attribution outside this explicit workflow.

### Non-goals

- Removing automatic initial attribution from valid session titles.
- Adding semantic issue matching, an issue picker, or support for non-Linear trackers.
- Adding an MCP server or direct Linear access from Codex.
- Starting the observer, reading Codex JSONL, opening DuckDB, or accepting Linear credentials in
  the skill.
- Adding Linear write operations; the observer continues to read issue metadata and write only its
  local attribution state.

### Dependencies

- Depends on Codex session ingestion providing the stable session identifier and on the completed
  Linear attribution capability providing exact issue resolution and atomic local persistence.
- Does not depend on the dashboard or packaged deployment changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `linear-session-attribution`: Make explicit relinking use a supplied issue identifier instead of
  deriving the target from the current session title, and define the narrow Codex workflow that
  invokes it.

## Impact

- Changes the authored relink API request contract and therefore regenerates tsoa routes, OpenAPI,
  and the frontend RTK Query client.
- Updates the backend relink service to resolve the supplied identifier instead of reparsing the
  current session title.
- Simplifies `.agents/skills/link-current-session/` to a narrow API workflow and removes its
  deterministic orchestration script and associated state-machine tests.
- Updates frontend relink callers to send the currently displayed candidate identifier explicitly.
- Requires regression coverage for direct linking, replacement, idempotency, invalid identifiers,
  missing sessions, Linear failures, and preservation of existing links on failure.
