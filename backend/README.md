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

## Foundation configuration

| Variable        | Default                        | Meaning               |
| --------------- | ------------------------------ | --------------------- |
| `HOST`          | `127.0.0.1`                    | HTTP listener address |
| `PORT`          | `3000`                         | HTTP listener port    |
| `DATABASE_PATH` | `data/ai-task-observer.duckdb` | Writable DuckDB file  |
| `LOG_LEVEL`     | `info`                         | Pino level            |

Configuration is validated before a listener or database is opened. Codex paths and Linear
credentials are deliberately not part of the foundation configuration.

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

The project will use the official DuckDB Node client rather than forcing DuckDB through an unsupported ORM dialect.

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
