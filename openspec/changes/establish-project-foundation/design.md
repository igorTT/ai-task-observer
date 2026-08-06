## Context

The repository currently contains project documentation and OpenSpec configuration but no executable applications or package manifests. The foundation must support the contracts in `specs/project-foundation/spec.md` while leaving Codex ingestion, Linear integration, accounting, dashboard features, and container deployment to later changes.

The primary architectural constraints are:

- Node.js is the backend development and production runtime; Bun is used only to execute tests.
- The frontend and backend remain independently buildable applications.
- The backend owns all DuckDB access and is the only writable process.
- The backend API is authored once and exported as OpenAPI; frontend server-state code is generated from that contract.
- Tests live in application-level `__tests__` trees that mirror `src`.
- Generated files are clearly separated from authored source.
- Each application owns an `@/*` alias that resolves only within its own `src` tree.

## Goals / Non-Goals

**Goals:**

- Create a small but production-shaped workspace that future changes can extend without restructuring it.
- Make application startup, configuration, persistence initialization, API generation, testing, and builds deterministic.
- Prove the native DuckDB client works under Node.js and within Bun-executed integration tests before product schemas depend on it.
- Establish boundaries between API controllers, modules, repositories, database row models, generated code, server state, and local UI state.
- Provide one root verification workflow suitable for local development and continuous integration.

**Non-Goals:**

- Define product tables for sessions, Linear issues, usage, or pricing.
- Add placeholder services for later product capabilities.
- Package the applications into production containers or implement runtime bind mounts.
- Optimize analytical queries before representative session data exists.
- Create a reusable framework or abstraction layer beyond this application.

## Decisions

### 1. Use npm workspaces and keep Bun test-only

The root will use npm workspaces for `frontend` and `backend`, with a pinned active Node.js LTS major declared in repository tooling and package engines. Root scripts delegate development, generation, linting, type checking, testing, and builds to the applications. Bun is installed in development and CI solely to run `bun test`.

This keeps dependency installation, lifecycle scripts, and production execution on the Node.js toolchain while honoring the chosen test runner.

**Alternatives considered:**

- **Bun workspaces and package management:** Rejected because it would make Bun part of installation and build behavior rather than test-only.
- **pnpm workspaces:** Technically suitable, but introduces another tool without a project requirement that justifies it.
- **Independent package roots without workspaces:** Rejected because duplicated installation and root verification commands would make the repository harder to operate consistently.

### 2. Separate process startup from Express application construction

`backend/src/app.ts` will construct and configure the Express application without opening a network port. `backend/src/server.ts` will own the startup sequence:

1. Load and validate configuration.
2. Initialize the DuckDB instance.
3. Apply pending migrations.
4. Construct the Express application and mount the API router.
5. Start the HTTP listener.
6. Register graceful shutdown for the listener and database resources.

This separation allows Supertest to exercise the application without starting a real listener and prevents the service from accepting requests before persistence is ready.

**Alternatives considered:**

- **Single entry file with immediate `listen()`:** Rejected because it couples process lifecycle to HTTP integration testing and encourages partially initialized startup.
- **Dependency-injection framework:** Rejected as unnecessary for the current number of boundaries; explicit factory parameters are sufficient.

### 3. Use authored tsoa controllers with a generated router boundary

HTTP operations will be declared in authored controllers under `backend/src/api/controllers`. Controllers validate the HTTP boundary and delegate to modules; they do not execute SQL or call future external SDKs directly. tsoa will generate route registration under `backend/src/api/generated` and an OpenAPI document under a repository-owned generated location. `backend/src/api/router.ts` will be the authored composition point that mounts generated routes and middleware.

The initial controller exposes `/api/health`. Product controllers are added only by later changes.

**Alternatives considered:**

- **Handwritten Express routers plus a separately maintained OpenAPI file:** Rejected because endpoint definitions and the contract can drift.
- **Contract-first OpenAPI with generated backend handlers:** Rejected because the team has selected Express and TypeScript controllers as the authored backend interface.
- **Decorator-free schema registration:** Viable, but tsoa directly satisfies route generation, request validation, and OpenAPI generation with less custom glue for this stack.

### 4. Generate the RTK Query client from the backend contract

The frontend will define one minimal RTK Query base API and generate endpoint injection plus hooks from the OpenAPI document using `@rtk-query/codegen-openapi`. A single root generation command will run backend route/spec generation before frontend client generation.

Generated backend routes, the OpenAPI document, and generated frontend client files will be committed for reviewability. CI will rerun generation and fail when the working tree changes, making stale output visible.

**Alternatives considered:**

- **Handwritten RTK Query endpoints:** Rejected because they duplicate request and response definitions already expressed by the API contract.
- **A shared TypeScript DTO package:** Rejected because it would bypass the OpenAPI boundary and create a second coupling path between applications.
- **Generating artifacts only during build and not committing them:** Rejected because contract changes would be harder to review and stale clients would not be detected before build time.

### 5. Access DuckDB through the official client and application repositories

The backend will use `@duckdb/node-api` directly. One cached DuckDB instance will own the configured file inside the backend process. SQL stays in ordered migration files and repository implementations. Passive types under `database/models` describe persisted rows; repositories map native result values into those types or module-level domain results.

The foundation migration creates only the migration ledger needed to track version, name, checksum, and applied time. Product tables are introduced with the product capability that owns them.

**Alternatives considered:**

- **DuckDB through an ORM:** Rejected because mainstream TypeScript ORMs do not provide a supported DuckDB dialect and a custom dialect would add more risk than the small repository layer removes.
- **SQLite:** Rejected because DuckDB is the accepted storage decision for the analytical workload.
- **Multiple processes opening the database:** Rejected to preserve DuckDB's single-writer invariant. Future consumers must use the backend API.

### 6. Apply each migration transactionally and verify its identity

Migrations will be ordered immutable SQL files with a monotonically increasing identifier. On startup, the runner reads the migration ledger, verifies that already-applied migration checksums still match, and applies each pending migration in its own transaction. It records the migration only after successful execution.

An edited applied migration or a failed pending migration stops startup with the migration identifier in the error. Rollback means restoring the last valid application/database pair; automatic down migrations are not introduced in the foundation.

**Alternatives considered:**

- **Schema synchronization on startup:** Rejected because implicit schema mutation is difficult to review and reproduce.
- **Down migrations:** Deferred because local analytical data can be backed up and forward-fixed; reliable downgrade behavior would add complexity before product schemas exist.

### 7. Validate configuration at a single backend boundary

The backend will have one configuration module that reads environment variables once, validates and normalizes them, and returns an immutable typed configuration object. The foundation requires host, port, database path, and log level. Product-specific settings such as Codex paths, Linear credentials, and model-pricing paths are added by their owning changes.

Configuration errors are structured and logged before the process exits. Modules receive configuration values explicitly instead of reading the environment directly.

**Alternatives considered:**

- **Reading `process.env` throughout modules:** Rejected because validation becomes inconsistent and tests become order-dependent.
- **Adding all anticipated future settings now:** Rejected because it would create unused mandatory configuration and pull later capabilities into scope.

### 8. Keep frontend server state and local UI state separate

The frontend will configure Redux Toolkit only for the RTK Query API reducer and middleware. Generated endpoint data stays in RTK Query. Zustand is available for local interface state but the foundation will add only the store boundary needed by the shell, not speculative product stores. Shareable route state belongs in React Router.

**Alternatives considered:**

- **Redux slices for all state:** Rejected because local interface operations are intentionally assigned to Zustand.
- **Copying query results into Zustand:** Rejected because it creates competing caches and ambiguous invalidation.
- **Using Zustand for server data:** Rejected because it would discard the generated RTK Query caching and invalidation contract.

### 9. Mirror source paths under root test directories

Each application will use a root `__tests__` directory whose internal paths mirror `src`. Frontend component tests use React Testing Library with a shared happy-dom setup. Backend HTTP tests use Supertest against the app factory. Database tests create an isolated temporary DuckDB file and close it after each test group.

The first backend database test is a compatibility gate: Bun must load `@duckdb/node-api`, create a database, apply the foundation migration, query the migration ledger, close the database, and reopen it.

**Alternatives considered:**

- **Colocated `*.test.ts` files:** Rejected because the accepted repository convention is a mirrored `__tests__` tree.
- **Mocking DuckDB in all tests:** Rejected because it would not validate the native binding or migration behavior.

### 10. Use one strict root verification pipeline

Root commands will provide formatting checks, linting, strict type checking, tests, generation, generated-output verification, and independent builds. CI will install Node dependencies from the lockfile, install the pinned Bun version, run generation, assert no generated diff, and then execute all verification commands.

The TypeScript base configuration enables strict mode and additional checks such as unchecked indexed access and exact optional property types unless a dependency forces a narrowly documented exception.

**Alternatives considered:**

- **Different local and CI command graphs:** Rejected because discrepancies allow failures that reproduce only in CI.
- **Adding pre-commit hooks in the foundation:** Deferred; CI and documented root commands provide the required enforcement without imposing a local Git-hook manager.

### 11. Use one application-local alias and rewrite it in the backend build

Both application TypeScript configurations will map `@/*` to their own `src/*` tree. Vite will expose the same frontend mapping, while backend development and tsoa generation will use the backend TypeScript configuration. Bun tests will resolve the alias through the relevant application TypeScript configuration.

Authored source will use `@/` for imports that cross directories. Same-directory `./` imports remain allowed because they keep tightly related modules easy to read. ESLint will reject parent-relative `../` imports in authored source; generated files are excluded because their import form is owned by generators.

TypeScript path mappings do not change emitted module specifiers, and Node.js does not natively resolve this TypeScript alias. The backend production build will therefore compile with `tsc` and then run `tsc-alias` to rewrite `@/` specifiers into resolvable relative JavaScript paths. CI will start the compiled backend under Node.js and call its health operation, proving that alias support is not limited to type checking or development tooling.

The aliases are deliberately application-local rather than workspace-wide. Neither application may use its alias to import the other's source; OpenAPI generation and the generated RTK Query client remain their only code-level integration contract.

**Alternatives considered:**

- **TypeScript `paths` without emitted-code rewriting:** Rejected because the compiled backend would contain module specifiers that Node.js cannot resolve.
- **Bundle the backend:** Rejected because bundling is unnecessary for this local service and complicates treatment of native dependencies such as DuckDB.
- **Multiple semantic aliases such as `@api`, `@modules`, and `@database`:** Rejected because one root alias is simpler and does not encode a directory taxonomy into every import.
- **Workspace-wide source aliases:** Rejected because they would allow frontend and backend source coupling outside the OpenAPI contract.
- **Require aliases for same-directory imports:** Rejected because `./` communicates local module proximity clearly and remains stable when a directory moves as a unit.

## Risks / Trade-offs

- **[Bun cannot load or reliably exercise the DuckDB native binding]** → Implement the DuckDB compatibility test before broader persistence work. If it fails on a required platform, stop the change and revise the accepted test-runner requirement rather than silently skipping database integration tests.
- **[Committed generated files create noisy diffs]** → Keep generated output in dedicated directories, use deterministic generator versions, and require one generation command.
- **[tsoa generation and frontend code generation can form a brittle chain]** → Pin generator versions, test the chain in a clean checkout, and fail CI on drift.
- **[DuckDB values do not map directly to JSON-safe JavaScript values]** → Centralize conversion in repositories and include representative conversion tests before product schemas add timestamps, decimals, or large integers.
- **[Foundation work expands into product implementation]** → Limit the initial controller to health, the initial database schema to migration metadata, and the frontend to a shell.
- **[Single-process DuckDB ownership limits future deployment shapes]** → Treat the backend HTTP API as the only access path so future processes do not depend on opening the file.
- **[Alias configuration drifts between TypeScript, Vite, tsoa, Bun, or the backend build]** → Keep one alias value per application, exercise it in application tests and generation, reject parent-relative authored imports through ESLint, and smoke-test the compiled backend under Node.js in CI.

## Migration Plan

1. Add root workspace metadata, pinned runtime declarations, shared TypeScript configuration, and root commands.
2. Initialize the backend lifecycle, configuration, logging, health controller, and API generation.
3. Add DuckDB ownership, the migration ledger, migration runner, and the Bun compatibility test.
4. Initialize the frontend shell, routing, state providers, styling system, and test environment.
5. Add deterministic OpenAPI-to-RTK Query generation and generated-output checks.
6. Add repository-wide linting, formatting, type checking, builds, and CI.
7. Configure application-local aliases, parent-relative import linting, backend emitted-code rewriting, and alias-resolution tests.
8. Run all foundation verification from a clean dependency installation, including a compiled backend startup and health request.

There is no production data migration because the repository has no existing application database. If the foundation cannot be completed, rollback consists of reverting the scaffold and generated artifacts; no user data is affected.
