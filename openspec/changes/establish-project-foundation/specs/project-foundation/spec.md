## Purpose

Establishes a reproducible, testable frontend and backend foundation that later AI Task Observer capabilities can extend without redefining runtime, persistence, API-contract, or verification boundaries.

## ADDED Requirements

### Requirement: Executable application workspace

The repository SHALL provide independently buildable frontend and backend applications with documented root-level commands for development, linting, formatting checks, type checking, testing, API generation, and production builds.

#### Scenario: Fresh workspace verification

- **WHEN** a contributor installs the declared dependencies in a fresh checkout and runs the documented verification commands
- **THEN** both applications SHALL lint, type check, test, and build without requiring Codex session data or Linear credentials

#### Scenario: Independent application build

- **WHEN** a contributor builds either the frontend or backend application independently
- **THEN** the selected application SHALL build without requiring the other application to be running

### Requirement: Declared runtime and test-runner boundary

The backend SHALL run under the repository's declared Node.js runtime, and automated unit and integration tests for both applications SHALL execute through Bun.

#### Scenario: Backend runtime startup

- **WHEN** the backend is started with a supported Node.js version and valid foundation configuration
- **THEN** it SHALL initialize successfully and begin accepting HTTP requests

#### Scenario: Bun test execution

- **WHEN** a contributor runs the repository test command
- **THEN** Bun SHALL discover and execute the frontend and backend test suites, including the backend DuckDB compatibility test

### Requirement: Application-local import aliases

Each application SHALL define `@/*` as an alias for its own `src/*` tree. Authored source SHALL use this alias for cross-directory imports, SHALL NOT use parent-relative imports, and MAY use relative imports for modules in the same directory. The alias SHALL resolve consistently during type checking, frontend and backend development, tsoa and OpenAPI generation, Bun tests, production builds, and Node.js execution of the compiled backend.

#### Scenario: Cross-directory authored import

- **WHEN** authored frontend or backend source imports a module outside its current directory
- **THEN** the import SHALL use `@/` and SHALL resolve within that application's own `src` tree

#### Scenario: Same-directory authored import

- **WHEN** authored source imports a module from its current directory
- **THEN** a `./` relative import SHALL remain valid

#### Scenario: Parent-relative authored import

- **WHEN** linting encounters an authored source import that begins with `../`
- **THEN** linting SHALL fail with an import-boundary violation

#### Scenario: Application boundary

- **WHEN** frontend or backend source resolves an `@/` import
- **THEN** it SHALL NOT resolve source from the other application, and frontend-to-backend communication SHALL continue through the generated OpenAPI client

#### Scenario: Compiled backend execution

- **WHEN** the production backend build is executed by Node.js
- **THEN** all authored alias imports SHALL have been converted into paths that Node.js can resolve without a TypeScript path resolver

### Requirement: Validated backend startup

The backend SHALL validate its required foundation configuration before opening the HTTP listener and SHALL report actionable startup errors without partially starting the service.

#### Scenario: Valid configuration

- **WHEN** the backend receives valid host, port, and writable database-path configuration
- **THEN** it SHALL complete configuration validation and continue initialization

#### Scenario: Invalid configuration

- **WHEN** a required configuration value is missing, malformed, or unusable
- **THEN** the backend SHALL exit initialization with a non-success result and identify the invalid setting

### Requirement: Operational health contract

The backend SHALL expose an HTTP health operation that reports whether the process and persistence foundation completed initialization.

#### Scenario: Healthy backend

- **WHEN** a client requests the health operation after configuration validation and database initialization succeed
- **THEN** the backend SHALL return a successful response with an explicit healthy status

#### Scenario: Initialization failure

- **WHEN** database initialization or migration fails
- **THEN** the backend SHALL not report a healthy status or begin normal request handling

### Requirement: Versioned DuckDB initialization

The backend SHALL be the sole writable owner of the configured DuckDB file and SHALL apply ordered, versioned SQL migrations before serving normal API requests.

#### Scenario: New database initialization

- **WHEN** the backend starts with a writable path at which no application database exists
- **THEN** it SHALL create the database, apply all pending migrations in order, record their completion, and make the initialized connection available to repositories

#### Scenario: Existing database initialization

- **WHEN** the backend starts with a database whose recorded migrations are current
- **THEN** it SHALL leave completed migrations unchanged and make the database available without duplicating migration effects

#### Scenario: Migration failure

- **WHEN** a pending migration cannot be applied atomically
- **THEN** the backend SHALL fail startup, preserve the last successfully migrated schema state, and report the failing migration

### Requirement: Persistence isolation

Application persistence SHALL be accessed through backend repositories that return application-owned types rather than exposing database-driver result objects across module or API boundaries.

#### Scenario: Repository query result

- **WHEN** a backend module requests persisted data through a repository
- **THEN** the repository SHALL return a typed application record or domain result without exposing a raw DuckDB result object

#### Scenario: Frontend data access

- **WHEN** the frontend requires persisted information
- **THEN** it SHALL obtain that information through the backend HTTP API and SHALL not open or write the DuckDB file

### Requirement: Reproducible OpenAPI client generation

The backend API definition SHALL produce an OpenAPI document from authored API declarations, and the frontend SHALL generate its server-state client from that document through a deterministic repository command.

#### Scenario: Contract generation

- **WHEN** a contributor runs the API generation command from a clean checkout
- **THEN** the repository SHALL generate the OpenAPI document and frontend API client in their designated generated locations

#### Scenario: Stale generated output

- **WHEN** authored API declarations change without the corresponding generated artifacts being updated
- **THEN** continuous integration SHALL fail with a generated-output drift indication

#### Scenario: Generated file ownership

- **WHEN** API contract artifacts are generated
- **THEN** generated routes and client files SHALL remain separated from authored controllers, routers, and frontend application code

### Requirement: Frontend application shell

The frontend SHALL provide a routable application shell with the required providers for generated server-state access and independent local interface state, without requiring product feature screens.

#### Scenario: Initial frontend render

- **WHEN** the frontend application starts in development or from a production build
- **THEN** it SHALL render the application shell and a valid initial route without requiring imported sessions or Linear data

#### Scenario: State ownership

- **WHEN** the frontend introduces server-derived data and local display state
- **THEN** server-derived data SHALL remain owned by the generated server-state layer while local interface state SHALL remain independently managed

### Requirement: Baseline automated verification

The repository SHALL enforce strict type checking, linting, formatting checks, unit tests, integration tests, build verification, and API-generation consistency through repeatable commands suitable for continuous integration.

#### Scenario: Pull-request verification

- **WHEN** continuous integration evaluates a proposed change
- **THEN** it SHALL run the declared lint, formatting, type-check, test, generation-consistency, and build checks and fail if any check fails

#### Scenario: Mirrored test organization

- **WHEN** authored source modules receive automated tests
- **THEN** those tests SHALL be located under the application's root `__tests__` tree in a path that mirrors the tested `src` module
