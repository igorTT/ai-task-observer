## Why

Imported Codex sessions currently remain isolated usage records, so the system cannot explain which Linear issue a session contributed to. The established session-title convention already provides an explicit, human-controlled identifier, making deterministic Linear attribution the next required capability without introducing semantic matching.

## What Changes

- Parse a leading Linear issue identifier from each imported session title, with optional text after a colon retained as phase metadata but not required for attribution.
- Integrate the official Linear SDK behind a dedicated backend boundary configured through environment-provided credentials.
- Resolve parsed identifiers to Linear issues, cache the minimum issue metadata required by the product, and persist a single current attribution state per session.
- Re-evaluate attribution when a session is first imported or its title changes, and reconcile existing sessions during startup or an explicit synchronization request.
- Distinguish linked, unlinked, not-found, unconfigured, and transient-failure states without discarding imported session usage.
- Extend the generated API contract with attribution fields on session responses plus Linear synchronization status and an explicit synchronization operation.
- Keep credentials, issue descriptions, comments, and other unnecessary Linear content out of DuckDB and diagnostics.
- Non-goals: semantic or agent-based matching, manual link editing, multi-issue sessions, cost calculation, issue-usage aggregation, dashboard implementation, bidirectional Linear updates, and support for non-Linear trackers.
- Dependencies: the archived `project-foundation` and `codex-session-ingestion` capabilities provide validated startup, DuckDB repositories and migrations, generated OpenAPI boundaries, stable session identity, title updates, and observable ingestion.

## Capabilities

### New Capabilities

- `linear-session-attribution`: Deterministically parses Linear identifiers from Codex session titles, resolves and caches issue metadata, persists attribution state, and exposes synchronization and attribution status through the backend API.

### Modified Capabilities

None.

## Impact

- Backend configuration gains optional Linear credentials and synchronization controls while remaining healthy when Linear is not configured.
- Backend dependencies gain the official Linear SDK.
- DuckDB gains Linear issue-cache, session-attribution, and synchronization-state persistence through new ordered migrations and repositories.
- Session ingestion publishes session-created and title-changed work to the attribution module without taking ownership of Linear behavior.
- Authored tsoa controllers and generated OpenAPI artifacts gain Linear status/synchronization operations and attribution response fields.
- Backend tests gain title-parser, repository, SDK-boundary, reconciliation, privacy, and API-contract coverage.
