# Backend

The backend owns Codex session ingestion, Linear issue enrichment, usage calculation, DuckDB persistence, and the HTTP API consumed by the frontend.

The Node.js application foundation is initialized with Express, tsoa, Pino, validated
configuration, and the official DuckDB Node API.

## Commands

Run from the repository root:

```bash
npm run dev -w backend
npm run generate -w backend
npm run typecheck -w backend
npm run test -w backend
npm run build -w backend
npm run start -w backend
```

The production command runs `dist/server.js` under Node.js. Bun is used only by the test
command. The root `npm run generate:api` command is preferred when changing controllers
because it also refreshes the frontend client.

Backend-authored code uses `@/*` for imports outside the current directory, where `@/`
resolves only to `backend/src`. Same-directory `./` imports remain valid. Development and
tsoa use this mapping directly; the production build runs `tsc-alias` so compiled output
contains Node.js-resolvable relative paths.

## Configuration

| Variable                    | Default                        | Meaning                                 |
| --------------------------- | ------------------------------ | --------------------------------------- |
| `HOST`                      | `127.0.0.1`                    | HTTP listener address                   |
| `PORT`                      | `3000`                         | HTTP listener port                      |
| `DATABASE_PATH`             | `data/ai-task-observer.duckdb` | Writable DuckDB file                    |
| `LOG_LEVEL`                 | `info`                         | Pino level                              |
| `CODEX_SESSION_ROOTS`       | `~/.codex/sessions`            | Comma-separated read-only session roots |
| `CODEX_READ_CHUNK_BYTES`    | `1048576`                      | Bounded source read size (1 KiB–16 MiB) |
| `CODEX_WATCH_DEBOUNCE_MS`   | `1000`                         | Duplicate filesystem-event debounce     |
| `CODEX_ROOT_REDISCOVERY_MS` | `60000`                        | Unavailable-root rediscovery interval   |
| `LINEAR_API_KEY`            | unset                          | Optional Linear personal API key        |
| `LINEAR_CACHE_TTL_MS`       | `3600000`                      | Linear issue-cache freshness window     |
| `LINEAR_MAX_CONCURRENCY`    | `4`                            | Maximum concurrent Linear issue reads   |

Configuration is validated before a listener or database is opened. Each root is evaluated
independently: missing, unreadable, and non-directory roots appear in import status without
making `/api/health` unhealthy. Check the path and read permissions when a root is unavailable;
the backend backfills it automatically when it later becomes readable.

Leaving `LINEAR_API_KEY` unset is supported: health, ingestion, and session APIs remain
available, parsed issue candidates report `unconfigured`, and the backend makes no Linear
requests. The key is read only from process configuration and is never persisted, logged, or
returned by the API.

## Session ingestion operations

Startup performs recursive historical discovery before Chokidar continues incremental
watching. Appends resume at the last committed complete-record byte offset. Incomplete trailing
JSON is deferred until its terminating newline arrives. Truncation, replacement, and parser
version changes trigger an atomic rebuild that preserves the last valid snapshot on failure.
Available roots are not periodically crawled; recursive discovery runs again only for an
explicit rescan, while the retry timer checks roots currently marked unavailable.

- `GET /api/imports/status` reports roots, runs, checkpoints, and sanitized diagnostics.
- `POST /api/imports/rescan` starts or coalesces an explicit backfill.
- `GET /api/sessions?limit=50&offset=0` lists sessions deterministically.
- `GET /api/sessions/{sessionId}` returns one normalized session or a documented 404.

## Linear attribution

A trimmed session title is attributable only when it begins with the exact grammar
`<team-key>-<positive-integer>[: <phase>]`. Team keys are letter-led and alphanumeric; issue
identifiers are normalized to uppercase. Examples are `ENG-215`, `ENG-215: apply`, and
`eng-215: review`. Phase text is optional, free-form metadata. Identifiers found later in an
ordinary title, zero or negative numbers, and suffix text without a colon stay unlinked.

The backend reconciles attribution after committed imports, at configured startup, and on an
explicit request. A valid title can establish the initial link only while the session has no
stored issue. Once linked, later title changes update the candidate and phase for review but do
not move or clear the stored issue. Issue lookups are grouped and concurrency-limited. A fresh
cached summary is reused until `LINEAR_CACHE_TTL_MS`; stale linked summaries are refreshed by
their stored issue identity during startup or manual synchronization. Confirmed absence becomes
`not_found` for an unlinked candidate and remains eligible for a later retry. Transient failures
do not erase an existing committed link.

- `GET /api/linear/status` reports configuration, synchronization state, outcome counts, and
  sanitized failure categories.
- `POST /api/linear/sync` starts or coalesces a reconciliation run. It returns `409` with code
  `linear_unconfigured` when no key is configured.
- `POST /api/sessions/{sessionId}/relink` explicitly resolves the current valid title candidate
  and replaces the stored link only after exact success. Missing candidates, stale titles,
  inaccessible issues, authentication failures, identifier mismatches, and transient failures
  return sanitized errors while preserving the previous link.

Linear access is strictly read-only. Attribution never changes issues, comments, labels, or
workflow state. Only the issue ID, identifier, title, URL, team summary, workflow-state summary,
and synchronization timestamps are cached. Descriptions, comments, attachments, raw SDK
payloads, credentials, and transcript content are outside the persistence and API boundary.

Persistence and APIs contain source-derived identity, titles, timestamps, turns, and token
facts, but never transcript text, reasoning, tool arguments, tool results, or raw malformed
records.

## Migrations

SQL files in `src/database/migrations` use immutable `NNN_name.sql` names. Startup verifies
the stored SHA-256 checksum of every applied migration and applies each pending file in its
own transaction. To add a migration, create the next ordered SQL file; never edit an applied
migration. The production build copies migrations beside the compiled database code.

## Responsibilities

- Discover historical Codex Desktop session files
- Watch for new and updated sessions
- Parse Codex session events safely and incrementally
- Extract the Linear issue identifier and optional phase from session titles
- Count developer turns and token usage
- Calculate estimated cost from the JSON pricing configuration
- Fetch and cache issue metadata through the Linear SDK
- Persist normalized data and import checkpoints in DuckDB
- Aggregate usage by Linear issue
- Generate and serve the OpenAPI contract
- Serve the production frontend bundle

## Stack

- Node.js runtime
- TypeScript
- Express
- Official DuckDB Node client (`@duckdb/node-api`)
- Official Linear SDK
- OpenAPI generation with runtime request validation
- Chokidar for session discovery
- Pino for structured logging
- Bun test
- Supertest for HTTP integration tests

Bun is used as the test runner only. The application runs on Node.js in development and production.

## Data flow

```text
Codex session file
        |
        v
Session discovery and parser
        |
        +--> title attribution: ENG-215: apply
        +--> developer-turn count
        +--> token totals
        |
        v
Linear issue enrichment
        |
        v
Cost calculation from versioned JSON configuration
        |
        v
DuckDB repositories
        |
        v
Express API
```

## DuckDB access

The backend is the sole writable owner of the DuckDB file. Other processes must use the HTTP API instead of opening the database directly.

The project uses the official DuckDB Node client rather than forcing DuckDB through an unsupported ORM dialect.

Database access should be isolated behind repositories:

```text
backend/src/database/
├── database.ts
├── migrate.ts
├── migrations/
├── models/
│   ├── session.model.ts
│   ├── linear-issue.model.ts
│   ├── session-usage.model.ts
│   └── import-checkpoint.model.ts
└── repositories/
    ├── session-repository.ts
    ├── issue-repository.ts
    ├── usage-repository.ts
    └── import-checkpoint-repository.ts
```

SQL migrations are the source of truth for the physical DuckDB schema. Database models are passive TypeScript row types that describe persisted records and conversions; they do not contain queries or Active Record-style behavior. Queries must be parameterized, and repositories are responsible for mapping database results into these models or higher-level domain objects.

## Expected source layout

```text
backend/
├── src/
│   ├── api/
│   │   ├── controllers/      Authored tsoa controllers
│   │   │   ├── issues.controller.ts
│   │   │   ├── sessions.controller.ts
│   │   │   ├── imports.controller.ts
│   │   │   └── system.controller.ts
│   │   ├── middleware/       Error handling and request middleware
│   │   ├── generated/        Generated tsoa route registration
│   │   └── router.ts         Handwritten API composition point
│   ├── config/               Environment and JSON configuration
│   ├── database/
│   │   ├── migrations/       Ordered SQL schema migrations
│   │   ├── models/           Persisted DuckDB row types
│   │   ├── repositories/     Parameterized queries and row mapping
│   │   ├── database.ts       DuckDB instance and connection ownership
│   │   └── migrate.ts        Migration runner
│   ├── modules/
│   │   ├── sessions/         Discovery, parsing, and import
│   │   ├── linear/           Linear synchronization
│   │   ├── usage/            Token and turn aggregation
│   │   └── pricing/          Cost calculation
│   ├── observability/        Logging and operational status
│   ├── app.ts                Express application construction
│   └── server.ts             Process startup and graceful shutdown
├── config/
│   └── models.json           Versioned model and pricing rules
├── __tests__/
│   ├── api/                  Tests mirroring src/api
│   ├── database/             Tests mirroring src/database
│   ├── modules/              Tests mirroring src/modules
│   └── fixtures/             Anonymized Codex and Linear fixtures
└── README.md
```

Controllers are explicit, authored application code. They define the HTTP boundary and delegate business logic to the modules; they do not query DuckDB or call Linear directly.

The router is also explicit, but it does not duplicate endpoint declarations. `tsoa` generates route registration from the controllers into `api/generated/`, and `api/router.ts` mounts those generated routes together with middleware on the Express application. Generated route files must not be edited manually.

The `__tests__/` tree mirrors the production source tree. Shared external-data samples belong in `__tests__/fixtures/` rather than beside production parsers.

## Import requirements

Session imports must be:

- Idempotent
- Safe when a JSONL file is only partially written
- Resumable from a persisted checkpoint
- Able to backfill historical data
- Able to detect title changes
- Tolerant of unknown event types
- Explicit about unsupported or malformed sessions

The importer should preserve enough source identity to update an existing session rather than creating duplicates.

## API contract

The backend is the source of truth for the OpenAPI specification. Route definitions, runtime request validation, and the generated specification must remain aligned.

The frontend consumes only the generated RTK Query client. A CI check should regenerate the OpenAPI document and frontend client and fail on an unexpected diff.

## Configuration

Future product changes are expected to add:

- API host and port
- Codex sessions path
- DuckDB file path
- Linear API token
- Linear workspace or team selection
- Model-pricing JSON path
- Log level
- Import debounce or polling settings

Those future values are not required by the current application. New configuration must be
added to the single validated startup boundary when its owning capability is implemented.

## Testing

- Title parsing, event parsing, and pricing: Bun test
- Repository integration: Bun test against a temporary DuckDB file
- HTTP API: Bun test and Supertest
- Session importer: fixture-based tests using anonymized Codex session files
- Linear integration: mocked SDK boundary tests

A compatibility test must verify that the DuckDB native client can be loaded and exercised by Bun test on supported development and CI platforms, even though production runs on Node.js.

## Docker

The production container should:

- Use a Debian-based Node.js image suitable for DuckDB native bindings
- Run as a non-root user
- Mount the Codex sessions directory read-only
- Store DuckDB in a persistent writable volume
- Receive Linear credentials through environment variables or secrets
- Expose a health endpoint
- Close the file watcher and DuckDB connections during graceful shutdown
- Serve the built frontend assets

Docker Compose does not need a DuckDB service because DuckDB is embedded in this process.

## Verification

HTTP tests construct the Express app without a listener. Database tests create isolated
temporary files, validate idempotency and atomic failure, and prove Bun can load, close, and
reopen the native DuckDB client.
