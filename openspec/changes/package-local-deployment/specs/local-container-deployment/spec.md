## Purpose

Packages AI Task Observer as a reproducible, local-only container that safely reads Codex sessions,
persists DuckDB data, and serves the production frontend and API through one process.

## ADDED Requirements

### Requirement: Reproducible production image

The repository SHALL produce a production container image from a clean checkout and the committed
dependency lock. The image SHALL contain the compiled backend, production frontend, SQL migrations,
pricing catalog, and production runtime dependencies required to start without source files,
development dependencies, or Bun.

#### Scenario: Image is built from a clean checkout

- **WHEN** a contributor builds the documented image with the supported container engine
- **THEN** both workspaces SHALL build from locked dependencies and the resulting image SHALL contain every runtime artifact required for startup

#### Scenario: Production image starts

- **WHEN** the image starts with valid container configuration and mounts
- **THEN** the compiled backend SHALL run under the declared Node.js runtime and SHALL load the native DuckDB client successfully

#### Scenario: Required artifact is omitted

- **WHEN** the image is missing a migration, pricing file, production dependency, or configured frontend bundle
- **THEN** image verification or application startup SHALL fail clearly rather than report a healthy partial deployment

### Requirement: Single application service

The local Compose deployment SHALL run one application service that owns the HTTP listener,
session ingestion, Linear integration, cost calculation, and the only writable DuckDB connection.
It SHALL NOT require a database service or a second process that opens the DuckDB file for writing.

#### Scenario: Compose deployment starts

- **WHEN** a user starts the documented Compose project
- **THEN** one application service SHALL initialize migrations and application lifecycles before accepting normal requests

#### Scenario: Linear is not configured

- **WHEN** the Compose deployment starts without a Linear credential
- **THEN** the application SHALL remain healthy with ingestion and dashboard access available and Linear reported as unconfigured

#### Scenario: Compose topology is inspected

- **WHEN** a user renders the effective Compose configuration
- **THEN** it SHALL contain no separate DuckDB or other database service

### Requirement: Production frontend and API hosting

The production backend SHALL serve generated API resources and the built frontend from the same
HTTP origin. Recognized and unknown `/api` requests SHALL retain API semantics, static assets SHALL
be served directly, and eligible non-API browser navigation SHALL fall back to the frontend entry
document.

#### Scenario: API route is requested

- **WHEN** a client requests a recognized `/api` route
- **THEN** the backend SHALL return the API response without allowing frontend fallback to intercept it

#### Scenario: Unknown API route is requested

- **WHEN** a client requests an unknown `/api` route
- **THEN** the backend SHALL return the documented JSON not-found response and SHALL NOT return frontend HTML

#### Scenario: Frontend asset is requested

- **WHEN** a client requests an asset emitted by the production frontend build
- **THEN** the backend SHALL return that asset with an appropriate content type

#### Scenario: Frontend route is opened directly

- **WHEN** a browser requests a valid client-side route such as an issue detail URL
- **THEN** the backend SHALL return the frontend entry document so the client router can render the route

#### Scenario: Unsafe fallback method is used

- **WHEN** a non-GET request does not match an API or static resource
- **THEN** the backend SHALL return a not-found response and SHALL NOT serve the frontend entry document

### Requirement: Local-only network exposure

The default Compose deployment SHALL publish the application only on the host loopback interface.
The container listener MAY bind to all container interfaces as required for port forwarding, but
the documented deployment SHALL NOT expose the unauthenticated application on every host network
interface.

#### Scenario: Default port is published

- **WHEN** the Compose application is running with default configuration
- **THEN** the dashboard and API SHALL be reachable from the local host at the documented port and SHALL be bound to host loopback

#### Scenario: User considers remote access

- **WHEN** a user needs access from another machine
- **THEN** the documentation SHALL identify public binding as unsupported without a separately designed authentication and transport-security boundary

### Requirement: Read-only Codex input boundary

The deployment SHALL mount only the user-selected Codex sessions directory into the application as
read-only input. It SHALL NOT require mounting the complete Codex configuration directory, and the
container SHALL not modify, create, archive, or delete source session files.

#### Scenario: Session directory is mounted

- **WHEN** the user supplies a readable Codex sessions path and starts the deployment
- **THEN** ingestion SHALL discover the mounted session files while the mount remains read-only to the application

#### Scenario: Selected path is unavailable or unreadable

- **WHEN** the configured host session directory cannot be mounted or read
- **THEN** startup or import status SHALL report an actionable mount or root-availability problem without substituting another host directory

#### Scenario: Full Codex home is not provided

- **WHEN** the deployment follows the documented configuration
- **THEN** Codex credentials and unrelated configuration files outside the selected sessions directory SHALL not be present in the container

### Requirement: Persistent writable application data

The Compose deployment SHALL store the DuckDB file in a dedicated persistent writable volume that
is not part of the image or Codex input mount. Recreating or upgrading the application container
SHALL preserve the database until the user explicitly removes or replaces that volume.

#### Scenario: Application container is recreated

- **WHEN** the container is stopped and recreated with the same data volume
- **THEN** previously committed sessions, attribution, usage, costs, and migration records SHALL remain available

#### Scenario: Fresh data volume is used

- **WHEN** the application starts with an empty writable volume
- **THEN** it SHALL initialize a new DuckDB database and apply all migrations before becoming healthy

#### Scenario: Data path is not writable

- **WHEN** the runtime identity cannot create or update the configured database path
- **THEN** application startup SHALL fail and the container SHALL not report healthy

### Requirement: Runtime configuration and secret isolation

Container-specific host, port, data path, session path, and frontend path settings SHALL be
provided through validated runtime configuration. Optional Linear credentials SHALL be injected
at runtime, SHALL not be required for the image build, and SHALL not be copied into image layers,
committed files, health responses, or logs.

#### Scenario: Valid runtime configuration is supplied

- **WHEN** the container receives the documented paths and optional integration settings
- **THEN** the backend SHALL validate them and initialize using only the mounted or image-owned resources they identify

#### Scenario: Runtime configuration is invalid

- **WHEN** a required container path, port, or other validated value is malformed or unusable
- **THEN** startup SHALL exit unsuccessfully with a safe, actionable configuration error

#### Scenario: Image is built without credentials

- **WHEN** the production image is built in an environment with no Linear credential
- **THEN** the build SHALL succeed and inspection of the resulting image SHALL reveal no embedded Linear secret

### Requirement: Least-privilege runtime

The production application SHALL run as a non-root identity with write access limited to its
dedicated data volume and explicitly required temporary storage. The deployment SHALL drop
unneeded privileges and SHALL keep application code, frontend assets, configuration shipped in the
image, and Codex input read-only at runtime.

#### Scenario: Runtime identity is inspected

- **WHEN** the application process is inspected inside the running container
- **THEN** its effective user ID SHALL not be zero

#### Scenario: Application persists data

- **WHEN** the non-root process imports a session or updates application state
- **THEN** it SHALL write successfully to the dedicated application data volume

#### Scenario: Application attempts to write outside allowed storage

- **WHEN** the runtime process attempts to modify image content or the Codex input mount
- **THEN** the filesystem or mount boundary SHALL reject the write

### Requirement: Health and graceful lifecycle

The container SHALL expose a health check backed by the initialized application health operation.
On termination it SHALL stop accepting new work, close the HTTP listener and background
coordinators, close DuckDB, and exit within the configured grace period without requiring a forced
kill during normal operation.

#### Scenario: Application initialization completes

- **WHEN** configuration, migrations, DuckDB, and application lifecycles initialize successfully
- **THEN** the container health check SHALL transition to healthy

#### Scenario: Application initialization fails

- **WHEN** startup fails before normal request handling
- **THEN** the container SHALL remain unhealthy or exit unsuccessfully and SHALL not return a false healthy status

#### Scenario: Container receives normal termination

- **WHEN** the container runtime sends its normal termination signal
- **THEN** the application SHALL complete graceful shutdown within the documented stop grace period

#### Scenario: Application restarts after graceful shutdown

- **WHEN** the service restarts with the same data volume after a normal stop
- **THEN** DuckDB SHALL open successfully and committed data SHALL remain queryable

### Requirement: Backup, restore, and upgrade workflow

The deployment documentation SHALL define a recoverable stopped-service backup and restore
procedure for the persistent data volume and a migration-aware image upgrade procedure. It SHALL
warn against copying the DuckDB files as a claimed consistent backup while the application writer
is active.

#### Scenario: User creates a backup

- **WHEN** the user follows the documented backup procedure
- **THEN** the application writer SHALL be stopped before the volume contents are copied and the resulting backup SHALL contain the database files needed for restoration

#### Scenario: User restores a backup

- **WHEN** the user restores a stopped-service backup into an empty or explicitly selected data volume and starts a compatible image
- **THEN** the application SHALL open the restored database and expose its committed data

#### Scenario: User upgrades the image

- **WHEN** the user backs up data and starts a newer image against the existing volume
- **THEN** pending migrations SHALL run before health succeeds and the documented rollback guidance SHALL account for migrations that older images may not understand

### Requirement: Deployment verification

The repository SHALL provide an explicit container verification command suitable for a Docker-capable
development or CI environment. Container verification SHALL be separate from the default
non-container verification pipeline and SHALL exercise the built image rather than only inspect
configuration text.

#### Scenario: Container verification runs

- **WHEN** a contributor runs the documented container verification command
- **THEN** it SHALL build the image and verify non-root execution, health, frontend and deep-link serving, API not-found isolation, native DuckDB startup, session ingestion, read-only input, graceful stop, and persistence across recreation

#### Scenario: Docker is unavailable

- **WHEN** a contributor runs the existing default repository verification without a container engine
- **THEN** linting, type checking, Bun tests, application builds, and backend smoke checks SHALL remain runnable without invoking container verification
