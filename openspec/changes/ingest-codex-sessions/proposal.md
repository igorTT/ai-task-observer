## Why

The project foundation can start and persist data, but it has no Codex session data to observe. AI Task Observer needs a reliable, privacy-conscious ingestion capability that can backfill existing Codex Desktop sessions, follow later changes, and preserve trustworthy token and developer-turn facts for downstream Linear attribution and accounting.

## What Changes

- Add validated configuration for one or more Codex Desktop session roots without requiring Linear credentials or pricing configuration.
- Discover supported Codex session files recursively and perform a historical backfill on startup or explicit rescan.
- Watch configured roots for new and changed session files, debounce duplicate file-system notifications, and import complete appended records incrementally.
- Parse supported Codex session records through a versioned adapter that emits normalized session identity, current title, timestamps, token categories, and developer-turn facts without persisting prompt, response, tool argument, or tool result content.
- Add DuckDB migrations, passive row models, and repositories for normalized sessions, session usage totals, and atomic import checkpoints.
- Make imports idempotent and resumable, including safe handling of partial trailing JSONL records, process interruption, file truncation or replacement, session-title changes, unknown record types, and malformed records.
- Expose generated-contract API operations for import status, explicit rescan, paginated session summaries, and session details.
- Add anonymized Codex fixtures plus unit, repository, importer, watcher, and HTTP tests under the mirrored backend `__tests__` tree.

### Non-goals

- Parsing a Linear identifier or workflow phase from the session title.
- Authenticating with Linear, fetching issues, or linking sessions to issues.
- Loading a model-pricing catalog, calculating dollar cost, or aggregating usage by issue.
- Persisting full prompts, assistant responses, reasoning content, tool arguments, tool results, or a database-managed model catalog.
- Adding dashboard screens, Docker packaging, MCP, semantic matching, other AI harnesses, release management, or generic OTLP ingestion.
- Guaranteeing support for undocumented future Codex record shapes; unknown shapes are reported and retained for later parser support without corrupting known session totals.

### Dependencies

This change depends on the architecture and verification boundaries established by `establish-project-foundation`: Node.js runtime, Bun tests, validated configuration, backend-owned DuckDB access, SQL migrations, authored tsoa controllers, generated OpenAPI routes, and generated RTK Query clients.

It provides the session data required by the planned `attribute-sessions-to-linear` and `calculate-issue-usage` changes. Those later changes must consume this capability rather than reopening Codex files or DuckDB independently.

## Capabilities

### New Capabilities

- `codex-session-ingestion`: Discovers, parses, incrementally imports, persists, and exposes privacy-safe Codex Desktop session and usage facts with resumable status reporting.

### Modified Capabilities

None.

## Impact

- Adds product DuckDB tables and migrations for Codex sessions, usage totals, and import checkpoints.
- Adds session discovery, parser, importer, watcher, and status modules under the backend session boundary.
- Extends backend configuration with Codex session roots and ingestion timing settings.
- Adds authored session and import controllers, generated routes, OpenAPI operations, and regenerated frontend RTK Query client output.
- Adds Chokidar runtime behavior and anonymized session fixtures while preserving the foundation's single-writer DuckDB and generated-file boundaries.
