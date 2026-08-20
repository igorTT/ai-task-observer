## Why

Developers can already attribute imported Codex Desktop sessions by renaming them with a Linear
identifier, but they cannot explicitly verify and commit the current task's attribution without
leaving Codex and finding the session in another interface. A Codex-initiated workflow can use the
stable task identifier to address the exact imported session while preserving the title as the
developer-controlled source of the Linear issue and phase.

## What Changes

- Add a repository-scoped, explicitly invoked Codex skill named `$link-current-session`.
- Resolve the active Codex task to its stable session identifier without treating a non-unique
  title match or task recency as identity.
- Add a deterministic Node.js script that inspects the session through the observer HTTP API,
  tolerates bounded ingestion delay, and invokes the existing explicit relink operation.
- Show the current title candidate and committed attribution before mutation, and require explicit
  confirmation before replacing a different committed issue link.
- Return concise, actionable outcomes for successful links, already-linked sessions, missing or
  ambiguous task identity, delayed ingestion, invalid titles, unavailable observer or Linear
  integration, and sanitized Linear resolution failures.
- Keep the observer backend as the only Linear client and DuckDB writer. The Codex workflow never
  accesses credentials, Codex JSONL files, DuckDB, or Linear directly.

### Non-goals

- Adding an MCP server or a general Codex tool surface.
- Changing title parsing, automatic initial attribution, exact Linear resolution, or atomic
  relinking semantics.
- Letting the user supply an arbitrary Linear issue identifier that differs from the current task
  title.
- Automatically invoking the workflow, linking on every turn, or silently choosing the newest of
  multiple title matches.
- Adding Linear write operations, semantic issue matching, or support for non-Codex harnesses.
- Requiring the usage dashboard or Docker packaging to use the workflow during development.

### Dependencies

- Depends on the completed Codex session ingestion and Linear session attribution capabilities,
  including session detail, explicit rescan, and atomic relink API operations.
- Does not depend on `build-usage-dashboard`; both changes only consume the existing backend API.
- Does not require `package-local-deployment`, although that change will provide the normal
  packaged observer URL and startup workflow for end users.

## Capabilities

### New Capabilities

- `codex-session-linking-workflow`: Explicitly resolve the current Codex task, inspect its observer
  attribution, and safely establish or replace its title-derived Linear issue link.

### Modified Capabilities

None.

## Impact

- Adds an authored repository skill and its Node.js HTTP client script under `.agents/skills/`.
- Adds mirrored Bun tests and fixtures for task selection, observer interaction, confirmation, and
  failure handling.
- Adds user documentation for explicit invocation, observer URL configuration, and expected
  outcomes.
- Reuses the existing generated backend API contract; no DuckDB schema, Linear SDK behavior,
  frontend API client, or backend route change is expected.
