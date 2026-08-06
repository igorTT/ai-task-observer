## 1. Workspace and shared tooling

- [x] 1.1 Create the root npm workspace manifest for `frontend` and `backend`, pin the supported Node.js LTS major, and add root development, generation, lint, format-check, type-check, test, and build scripts.
- [x] 1.2 Add shared strict TypeScript configuration with unchecked indexed-access and exact optional-property checks, then configure both applications to extend it.
- [x] 1.3 Add root ESLint flat configuration and Prettier configuration that cover authored TypeScript, React, tests, configuration files, and generated-file exclusions.
- [x] 1.4 Add repository ignore rules for dependencies, build output, temporary DuckDB files, local environment files, and generated scratch artifacts without ignoring committed generated contracts.
- [x] 1.5 Verify that the empty frontend and backend workspaces can install and execute their delegated root scripts independently.

## 2. Backend application and API boundary

- [x] 2.1 Initialize the backend TypeScript package with Node.js development and production scripts plus Express, tsoa, logging, configuration-validation, DuckDB, Bun-test, and Supertest dependencies.
- [x] 2.2 Implement the single configuration boundary for host, port, database path, and log level, including tests for valid normalization and actionable invalid-setting errors.
- [x] 2.3 Implement structured logger construction and ensure startup failures use the validated logging boundary rather than ad hoc console output.
- [x] 2.4 Implement `app.ts` as a listener-free Express application factory with JSON parsing, request logging, API routing, not-found handling, and centralized error middleware.
- [x] 2.5 Implement `server.ts` with ordered configuration, database, migration, application, and listener startup plus graceful shutdown of HTTP and database resources.
- [x] 2.6 Add an authored tsoa system controller for `/api/health`, the handwritten API router composition point, and generated route output in its dedicated directory.
- [x] 2.7 Add mirrored Bun and Supertest tests covering a healthy response, error serialization, invalid startup configuration, and construction of the app without a network listener.

## 3. DuckDB ownership and migrations

- [x] 3.1 Implement the backend-owned DuckDB instance and connection lifecycle using `@duckdb/node-api`, with explicit close behavior and no database access outside the persistence layer.
- [x] 3.2 Define the immutable ordered SQL migration convention and add the foundation migration ledger with version, name, checksum, and applied timestamp fields.
- [x] 3.3 Implement the migration row model and repository mapping without exposing native DuckDB result objects to callers.
- [x] 3.4 Implement the transactional migration runner with pending-migration discovery, checksum verification, idempotent restart behavior, and failure reporting that identifies the migration.
- [x] 3.5 Add mirrored database integration tests for new database creation, current database reopening, duplicate-effect prevention, checksum mismatch, and atomic migration failure.
- [x] 3.6 Add the Bun compatibility gate that loads the native DuckDB client, applies the foundation migration to a temporary file, queries it, closes it, and successfully reopens it.

## 4. Frontend application shell

- [x] 4.1 Initialize the React and Vite TypeScript package with independent development, type-check, test, and production-build commands.
- [x] 4.2 Configure Tailwind CSS and shadcn/ui conventions, then add only the shared primitives required by the initial application shell.
- [x] 4.3 Implement the React Router application shell and initial route so it renders without Codex data, Linear credentials, or a running product feature.
- [x] 4.4 Configure the minimal Redux Toolkit store containing only the RTK Query reducer and middleware, with no conventional local-state slices.
- [x] 4.5 Add the Zustand local-state boundary with one shell-level display preference and keep route state in React Router.
- [x] 4.6 Configure Bun, happy-dom, and React Testing Library under the mirrored frontend `__tests__` tree and test the initial render, routing, provider setup, and local-state behavior.

## 5. OpenAPI and generated client pipeline

- [x] 5.1 Configure tsoa to generate OpenAPI and route registration from authored controllers into dedicated committed generated locations.
- [x] 5.2 Add the frontend RTK Query base API and configure `@rtk-query/codegen-openapi` to generate endpoint injection and React hooks from the backend OpenAPI document.
- [x] 5.3 Add one deterministic root API-generation command that runs backend spec-and-route generation before frontend client generation.
- [x] 5.4 Integrate the generated health endpoint into the frontend API layer and add a focused test proving the generated client matches the health contract.
- [x] 5.5 Add a generated-output verification command that regenerates all contract artifacts and fails when committed output is stale or authored/generated boundaries are violated.

## 6. Continuous integration and documentation

- [x] 6.1 Add continuous integration that uses the lockfile, the pinned Node.js runtime, and a pinned Bun version to run generation-drift, formatting, lint, type-check, test, and independent build checks.
- [x] 6.2 Update the root, frontend, and backend READMEs with exact installation, development, generation, verification, environment, migration, and build commands implemented by this change.
- [x] 6.3 Add an example environment file containing foundation settings only and verify that no credentials or future product configuration are required for foundation checks.
- [x] 6.4 Perform a clean-checkout verification with dependency installation, API generation, all root checks, frontend build, backend build, Node.js backend startup, and a successful health request.

## 7. Application-local import aliases

- [x] 7.1 Configure `@/*` to resolve to the local `src/*` tree in the frontend and backend TypeScript configurations, and configure Vite to use the same frontend mapping.
- [x] 7.2 Configure backend development and tsoa generation to resolve the backend alias, then add `tsc-alias` rewriting after `tsc` so compiled output runs directly under Node.js.
- [x] 7.3 Add ESLint enforcement that rejects parent-relative `../` imports in authored source while allowing same-directory `./` imports and excluding generated files.
- [x] 7.4 Convert existing cross-directory authored imports to `@/` without introducing frontend-to-backend source imports.
- [x] 7.5 Add focused frontend, backend, Bun-test, and API-generation checks for alias resolution, then smoke-test the compiled backend under Node.js with a successful health request.
