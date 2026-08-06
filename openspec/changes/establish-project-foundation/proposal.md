## Why

AI Task Observer currently has an agreed product direction and repository documentation but no executable frontend, backend, persistence layer, API contract, or verification toolchain. Establishing a tested foundation now gives later Codex ingestion, Linear attribution, accounting, and dashboard changes a stable architecture instead of making each feature invent its own structure.

## What Changes

- Initialize independent TypeScript frontend and backend applications within the existing repository.
- Establish the Node.js backend runtime, Express application lifecycle, tsoa controller and route generation, runtime request validation, and a health endpoint.
- Establish DuckDB connection ownership, ordered SQL migrations, passive database models, and repository boundaries using the official Node client without an ORM.
- Establish the React and Vite application shell, React Router, Tailwind CSS, shadcn/ui conventions, RTK Query API integration, and Zustand local-state boundary.
- Generate the OpenAPI document from the backend and generate the RTK Query client from that contract, keeping authored and generated files separate.
- Configure Bun as the test runner for both applications while retaining Node.js as the development and production runtime.
- Configure strict TypeScript, ESLint, Prettier, mirrored `__tests__` layouts, foundational unit and integration tests, and continuous-integration checks.
- Configure an application-local `@/*` import alias for each application, prohibit parent-relative imports in authored source, and verify alias resolution across development, generation, tests, and production builds.
- Validate that `@duckdb/node-api` works in the Node.js runtime and can be exercised by Bun tests on supported development and CI platforms.

### Non-goals

- Codex session discovery, parsing, watching, or persistence.
- Linear authentication, synchronization, or session attribution.
- Token, turn, pricing, or issue-usage calculations.
- Product dashboard screens beyond a minimal application shell.
- Docker and Docker Compose deployment packaging.
- MCP, semantic matching, other AI harnesses, release management, or generic observability.
- Shared source aliases or direct imports between the frontend and backend; OpenAPI remains their application boundary.

### Dependencies

This change has no dependency on another OpenSpec change. It establishes the foundation required by the planned `ingest-codex-sessions`, `attribute-sessions-to-linear`, `calculate-issue-usage`, `build-usage-dashboard`, and `package-local-deployment` changes.

## Capabilities

### New Capabilities

- `project-foundation`: Defines the executable frontend/backend workspace, application lifecycle, DuckDB persistence boundary, OpenAPI generation pipeline, state-management boundary, and baseline verification commands required by later product capabilities.

### Modified Capabilities

None.

## Impact

- Adds frontend and backend package manifests, TypeScript source roots, tests, and build output conventions.
- Adds runtime and development dependencies for React, Vite, Express, tsoa, DuckDB, RTK Query, Zustand, validation, logging, and test support.
- Adds authored backend controllers and a generated route-registration boundary.
- Adds SQL migration infrastructure and a local DuckDB file configuration without defining product session or Linear schemas yet.
- Adds generated OpenAPI and frontend client artifacts plus checks that detect stale generated output.
- Adds repository-level linting, formatting, type checking, testing, build, and CI entry points.
- Adds application-local import-alias configuration, lint enforcement, backend build-time alias rewriting, and compiled-runtime verification.
