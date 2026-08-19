## Why

Imported Codex sessions currently remain isolated usage records, so the system cannot explain which Linear issue a session contributed to. A new Codex chat starts with its ordinary default title; once the developer knows which ticket it belongs to, they manually rename the chat using the established issue-title convention. That title can establish the initial link, but the persisted link remains under explicit user control thereafter instead of silently following later title changes.

## What Changes

- Treat a manually renamed Codex chat title as the initial attribution control surface: default titles remain unlinked, while titles such as `ENG-215` or `ENG-215: apply` can establish the first Linear link and provide optional phase metadata.
- Persist an established session-to-issue link independently of later title changes. Renaming a linked chat from `ENG-215` to `ENG-216` SHALL NOT silently move, replace, or clear its link.
- Parse a later title as a possible relink candidate and retain optional text after a colon as phase metadata, without changing the stored issue association.
- Provide an explicit user-initiated relink operation that resolves the current title candidate and replaces the stored issue link only after successful exact Linear resolution.
- Integrate the official Linear SDK behind a dedicated backend boundary configured through environment-provided credentials.
- Resolve parsed identifiers to Linear issues, cache the minimum issue metadata required by the product, and persist a single current attribution state per session.
- Evaluate unlinked sessions when first imported and whenever their titles change, so a default-title session can become initially linked without being recreated; reconcile stored links and issue metadata during startup or an explicit synchronization request without deriving a new link from a renamed title.
- Distinguish linked, unlinked, not-found, unconfigured, and transient-failure states without discarding imported session usage.
- Extend the generated API contract with attribution fields on session responses, a user-initiated relink operation, Linear synchronization status, and an explicit synchronization operation.
- Keep credentials, issue descriptions, comments, and other unnecessary Linear content out of DuckDB and diagnostics.
- Non-goals: semantic or agent-based matching, automatic reassignment of existing links, multi-issue sessions, cost calculation, issue-usage aggregation, dashboard implementation, bidirectional Linear updates, and support for non-Linear trackers.
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
- Session ingestion publishes session-created and title-changed work to the attribution module without taking ownership of Linear behavior; title changes can update candidates but cannot overwrite stored links.
- Authored tsoa controllers and generated OpenAPI artifacts gain Linear status/synchronization operations, an explicit session relink operation, and attribution response fields.
- Backend tests gain title-parser, repository, SDK-boundary, reconciliation, privacy, and API-contract coverage.
