# AI Task Observer

AI Task Observer is a local-first application for attributing OpenAI Codex Desktop usage to Linear issues.

The application discovers Codex sessions, reads the Linear issue identifier from each session title, enriches the issue through the Linear SDK, and reports how much Codex interaction was required to work on that issue.

The executable project foundation contains independent frontend and backend npm workspaces,
a generated OpenAPI client contract, and a tested DuckDB migration boundary.

## Development quick start

Requirements: Node.js 24 and npm. Bun 1.3.14 is installed by npm and is used only to run tests.

```bash
npm ci
cp .env.example .env
npm run generate:api
npm run dev
```

The frontend runs at `http://localhost:5173`; the backend listens at
`http://127.0.0.1:3000` by default. Verify health with:

```bash
curl http://127.0.0.1:3000/api/health
```

Repository checks are available independently or as a complete pipeline:

```bash
npm run verify:generated
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:frontend
npm run build:backend
npm run verify
```

`npm run generate:api` always generates the tsoa OpenAPI document and Express routes before
generating the frontend RTK Query endpoints and hooks. The three generated locations are
committed and must not be edited manually.

Each application owns an `@/*` alias for its own `src/*` tree. Use `@/` for cross-directory
authored imports and `./` only for same-directory modules. The backend build rewrites aliases
before Node.js execution; `npm run verify:aliases` checks this boundary.

Foundation configuration is read once by the backend from `HOST`, `PORT`, `DATABASE_PATH`,
and `LOG_LEVEL`. Defaults match `.env.example`; Codex paths, Linear credentials, and future
product configuration are not needed for installation, generation, tests, or builds.

## Problem

Codex Desktop exposes useful session-level activity, but it is difficult to answer questions such as:

- How many tokens did a Linear issue require?
- What was the estimated dollar cost of the work?
- How many developer turns and Codex sessions were needed?
- Which issues consumed unusually high Codex usage?

AI Task Observer connects those two sources of information without trying to infer the developer's workflow from scratch.

## Session attribution

The Linear issue identifier is part of the Codex session title:

```text
ENG-215: explore
ENG-215: apply
ENG-215: verify
```

The issue identifier is the authoritative link. The text after the colon is optional metadata that can be used to break usage down by workflow phase.

The currently recognized phases are:

- `explore` — exploration and proposal preparation
- `apply` — implementation
- `verify` — code review, styling changes, and artifact preparation

Several sessions can belong to the same issue and phase. Sessions whose titles do not contain a valid Linear identifier remain visible as unlinked sessions.

## Core workflow

```text
Codex Desktop session files
        |
        v
Discover and parse sessions
        |
        +--> extract turns and token usage
        |
        +--> extract Linear identifier from the title
        |
        v
Fetch and validate issue through the Linear SDK
        |
        v
Persist normalized data in DuckDB
        |
        v
Aggregate sessions, turns, tokens, and estimated cost by issue
        |
        v
Expose results through an HTTP API and web interface
```

## Reported metrics

The initial product reports:

- Number of linked Codex sessions
- Developer turns, defined as user messages submitted to Codex
- Input tokens
- Cached input tokens
- Output tokens
- Total tokens
- Estimated dollar cost
- Optional breakdown by session phase

Dollar amounts are estimates derived from a versioned JSON model and pricing configuration. The model catalog and pricing rules are application configuration, not database-managed entities.

## Scope

The initial scope includes:

- OpenAI Codex Desktop sessions only
- Historical session import
- Incremental session discovery and updates
- Title-based Linear issue attribution
- Linear issue enrichment through the official SDK
- Token, turn, and estimated-cost aggregation
- A local HTTP API and web dashboard
- Docker and Docker Compose support

The initial scope does not include:

- Other AI coding assistants
- Semantic or agent-based session matching
- MCP integration
- OpenSpec workflow orchestration
- Release management
- A general-purpose observability platform

## Architecture

The repository contains two applications:

```text
ai-task-observer/
├── frontend/       Web interface
├── backend/        API, session ingestion, Linear synchronization, and DuckDB
├── openspec/       Project specifications and change artifacts
└── README.md
```

The backend is the only process that owns the writable DuckDB database. The frontend communicates with it exclusively through the generated OpenAPI client.

## Technology stack

### Frontend

- React and TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- RTK Query for remote/server state
- Zustand for local UI state
- OpenAPI-generated RTK Query client
- Bun test as the test runner

### Backend

- Node.js runtime and TypeScript
- Express
- DuckDB through the official Node client
- Linear SDK
- OpenAPI generation and runtime request validation
- Bun test as the test runner

### Tooling

- Bun as the test runner only
- npm-compatible Node.js dependency and runtime tooling
- ESLint
- Prettier
- Docker
- Docker Compose

## Storage

DuckDB stores normalized application data such as:

- Imported Codex sessions
- Token and turn totals
- Session-to-Linear-issue attribution
- Cached Linear issue metadata
- Import checkpoints
- Calculated cost results

The model catalog and pricing configuration remain in a versioned JSON file. Database schema changes will be managed through ordered SQL migrations.

## Docker model

DuckDB is embedded in the backend, so Docker Compose does not require a separate database service.

The production deployment is expected to use one application container with:

- A read-only bind mount containing Codex session files
- A writable volume for DuckDB data
- Linear credentials provided through environment variables or secrets
- The built frontend served by the backend

Only the required Codex session directory should be mounted. The complete Codex configuration directory may contain credentials and should not be exposed to the container.

## Development status

The project foundation is implemented. Product capabilities such as Codex ingestion, Linear
attribution, usage calculation, dashboard screens, and deployment packaging remain planned.

See [frontend/README.md](frontend/README.md) and [backend/README.md](backend/README.md) for application-specific commands and boundaries.
