## Why

The application can be built and run from source, but it does not yet have a reproducible local
production package or serve its frontend and API as one product. A single-container deployment is
needed so a developer can run the observer safely against local Codex sessions while preserving
DuckDB data across upgrades.

## What Changes

- Add a multi-stage, Debian-based Node.js 24 production image that builds both workspaces and runs
  the compiled backend without Bun or development dependencies.
- Make the production backend serve the built frontend while preserving `/api` routing and
  supporting direct navigation to frontend routes through a safe SPA fallback.
- Add Docker Compose configuration for one application service, loopback-only host publishing, a
  read-only bind mount for the selected Codex sessions directory, and a persistent writable DuckDB
  volume.
- Run the application process as a non-root user and keep Linear credentials and other secrets out
  of the image and repository.
- Add container health checking, signal-driven graceful shutdown, and smoke verification for the
  frontend, API, native DuckDB client, persistence, and read-only session boundary.
- Add a minimal Docker build context and document configuration, first start, platform and mount
  prerequisites, troubleshooting, stopped-service backup and restore, and migration-aware upgrades.
- Dependencies: the implemented backend capabilities supply the production server, health route,
  migrations, ingestion, attribution, and accounting. The active `build-usage-dashboard` change
  supplies the final frontend routes and assets; deployment planning and backend packaging may
  proceed independently, but final image verification depends on its production build.
- Non-goals: Kubernetes or another orchestrator; a separate DuckDB service; remote or multi-user
  hosting; public network exposure, TLS, or application authentication; container registry and
  release automation; hot backup while the database writer is active; development containers;
  desktop installers; support for other AI harnesses; MCP; and the Codex-initiated linking workflow.

## Capabilities

### New Capabilities

- `local-container-deployment`: Reproducible single-container build, production frontend serving,
  local-only Compose operation, persistence and mount boundaries, health and shutdown behavior,
  and documented backup and upgrade workflows.

### Modified Capabilities

None. Existing API, ingestion, attribution, accounting, and frontend behavior remain unchanged;
this capability packages and hosts their production artifacts.

## Impact

- Adds a root Dockerfile, Compose file, `.dockerignore`, container smoke checks, and deployment
  documentation.
- Extends backend application composition and configuration to serve an optional production
  frontend directory without changing generated API routes.
- Adds production packaging scripts or copy steps for backend output, SQL migrations, pricing
  configuration, and `frontend/dist`.
- Updates environment examples and root verification commands where container checks are
  appropriate.
- Does not add a database migration or a second process with writable DuckDB access.
