## Context

See `proposal.md` for motivation and `specs/local-container-deployment/spec.md` for required
behavior. The repository already produces `frontend/dist` and `backend/dist`, copies SQL migrations
into the backend output, keeps the pricing catalog under `backend/config`, and starts the compiled
server under Node.js. The backend does not yet accept a frontend asset directory or distinguish SPA
fallback from its existing JSON not-found behavior.

Startup currently validates configuration, opens DuckDB, applies migrations, starts ingestion,
attribution, and cost calculation, and only then opens the HTTP listener. SIGINT and SIGTERM share
an idempotent close path. Those lifecycle properties are useful container boundaries and should be
extended rather than replaced. The active dashboard change may modify frontend source and tests,
but its output remains the standard Vite `frontend/dist` artifact.

## Goals / Non-Goals

**Goals:**

- Produce one small, inspectable runtime image whose filesystem contains only production
  dependencies and application artifacts.
- Make default Compose operation safe for a local, unauthenticated application through loopback
  publishing and least-privilege mounts.
- Preserve normal API-only development and backend testing while adding optional static frontend
  serving for packaged production.
- Make data ownership, startup readiness, shutdown, backup, restore, and upgrade behavior explicit
  enough that local usage does not depend on Docker folklore.
- Verify actual image behavior, native dependencies, and persistent state in a disposable test
  deployment.

**Non-Goals:**

- Making Docker a prerequisite for normal source development or `npm run verify`.
- Building a general configuration framework, ingress layer, secret manager, backup daemon, or
  image publication pipeline.
- Supporting multiple application replicas against one DuckDB volume.
- Modifying dashboard feature behavior or introducing a second production web server.

## Decisions

### 1. Build one multi-stage Debian Node.js image

The root Dockerfile will use a pinned Node.js 24 Debian slim base family for build, production
dependency, and runtime stages so the native DuckDB module is installed and executed against a
consistent glibc environment. A build stage runs `npm ci` from the workspace lock and produces both
workspace builds. A production-dependency stage installs or prunes to runtime dependencies. The
final stage copies production node modules, package metadata, `backend/dist`, `backend/config`, and
`frontend/dist` into fixed application paths.

The final command directly executes `node backend/dist/server.js`. Bun, TypeScript sources,
compiler tooling, tests, local build output, `.git`, `.env`, local DuckDB files, and Codex data are
excluded from the runtime image. A `.dockerignore` keeps the build context small and prevents local
secrets or state from entering any stage.

**Alternatives considered:** Alpine was rejected because musl increases native DuckDB compatibility
risk. A full Debian image was rejected because slim provides the required runtime with less
unrelated surface. Copying the builder's complete `node_modules` was rejected because it retains
development dependencies and Bun. Separate frontend and backend images were rejected because the
frontend only needs static hosting and another service would complicate local origin, lifecycle,
and deployment.

### 2. Make production frontend serving optional in backend composition and required in the image

Add an optional validated `FRONTEND_DIST_PATH`. When absent, the backend remains API-only for
current tests and Vite development. When present, startup verifies that the directory and
`index.html` are readable before listening, and application composition mounts static serving.
The container sets this path to the image-owned frontend directory, making the bundle mandatory for
packaged startup.

Request ordering is explicit:

```text
request
  |
  +--> generated API routes
  |
  +--> /api/* JSON not-found boundary
  |
  +--> production static assets
  |
  +--> eligible GET/HEAD HTML navigation -> index.html
  |
  +--> generic JSON not-found
  |
  +--> error middleware
```

SPA fallback applies only to safe navigation methods that accept HTML and never to `/api`. Static
serving does not expose dotfiles or directory listings. Hashed frontend assets receive cacheable
headers; `index.html` remains revalidated so upgrades do not pin an obsolete asset graph.

**Alternatives considered:** Nginx was rejected because it adds a second runtime process or
container for a small local application. Serving every unmatched request as `index.html` was
rejected because it converts API mistakes and unsafe methods into misleading HTML success.
Requiring frontend assets for every backend invocation was rejected because it would break
independent backend tests and source development.

### 3. Use one Compose service with fixed container paths and host-only substitution

The Compose service builds the root Dockerfile and uses fixed internal paths:

```text
/app/backend/dist                       compiled server
/app/backend/config                     pricing catalog
/app/frontend                           built frontend
/var/lib/ai-task-observer/sessions      Codex input (bind mount, read-only)
/var/lib/ai-task-observer/data          DuckDB data (named volume, writable)
```

Compose sets `HOST=0.0.0.0` inside the network namespace, publishes
`127.0.0.1:${AI_TASK_OBSERVER_PORT:-3000}:3000`, and sets the database, session, pricing, and
frontend paths explicitly. `${CODEX_SESSIONS_PATH}` is a required host-side substitution so Compose
fails rather than silently mounting an unintended empty directory. A named `observer-data` volume
persists database files without depending on a repository-local host directory.

**Alternatives considered:** Publishing `3000:3000` was rejected because it exposes an
unauthenticated local tool on all host interfaces. Mounting all of `~/.codex` was rejected because
that directory can contain credentials and unrelated state. A repository bind mount for DuckDB was
rejected because host ownership and accidental cleanup are more error-prone than a named volume.
A DuckDB service was rejected because DuckDB is embedded and the backend must remain its only
writer.

### 4. Run as non-root with an immutable runtime filesystem

The image creates required directories with ownership assigned to a fixed non-root application
identity before switching users. Compose keeps the image root filesystem read-only, mounts the
named data volume at the only persistent write location, supplies a size-bounded temporary
filesystem for `/tmp`, drops Linux capabilities, and enables no-new-privileges. The session bind
mount and image-owned application artifacts remain read-only.

The deployment guide explains that host session files must be readable through Docker's bind-mount
permission model. If a platform preserves restrictive ownership that the container identity cannot
read, the user must grant narrowly scoped read access or use a supported host mapping; running the
application as root is not the documented workaround. Import status continues to expose an
unavailable root when the mount exists but cannot be consumed.

**Alternatives considered:** Running as root was rejected because the container reads developer
session data and accepts an integration credential. Supporting arbitrary runtime UID/GID in the
first Compose file was rejected because it complicates named-volume initialization and homedir
behavior; platform-specific evidence can justify that addition later. A writable image filesystem
was rejected because the application has one explicit data location and temporary work can use
`/tmp`.

### 5. Inject configuration at runtime and keep secrets outside image metadata

The image defines safe non-secret defaults for container-internal host, port, data, session,
pricing, frontend, and log paths. Compose loads optional application settings from a gitignored
environment file and passes `LINEAR_API_KEY` only at runtime. Dockerfile `ARG` and `ENV` are never
used for credentials. The example environment distinguishes host-side Compose substitution
(`CODEX_SESSIONS_PATH`, published port) from variables consumed inside the application.

The initial local deployment uses environment injection rather than Compose secrets because the
Linear SDK expects an application value and the project is single-user. Documentation notes that
environment variables can be inspected by sufficiently privileged local Docker users and that
such users already control the container boundary.

**Alternatives considered:** Baking `.env` into the image was rejected because layers are durable
and inspectable. Requiring a secret manager was rejected as disproportionate for the local POC.
Passing credentials as command-line arguments was rejected because process listings and logs can
expose them.

### 6. Reuse application readiness and make signal handling observable

Compose health uses a small Node.js `fetch` probe against `/api/health`; no curl package is added to
the runtime image. Because the server listens only after configuration, migrations, database, and
coordinators initialize, a successful health response is also readiness for this single-process
deployment. Health timings allow first-run backfill startup without declaring failure too early.

Compose enables a minimal init process and defines a stop grace period. SIGTERM reaches Node's
existing idempotent shutdown path, which closes the HTTP listener, then ingestion, attribution,
cost calculation, and DuckDB. Tests assert normal stop completes inside the grace period and the
same volume reopens; forced termination remains the container runtime's last resort, not normal
behavior.

**Alternatives considered:** A port-open health check was rejected because it does not prove
application initialization. Adding a second readiness endpoint was rejected because the existing
health contract already starts after initialization. A shell-based supervisor was rejected because
the image has one Node process and Compose can provide minimal init behavior.

### 7. Require stopped-writer backups and migration-aware upgrades

The supported backup procedure stops the application service, uses a short-lived helper container
to archive the named data volume into a user-selected host directory, and then restarts the service.
Restore targets an empty or deliberately replaced volume while the application is stopped. Commands
use an explicit Compose project and volume name resolution step so users do not guess Docker's
generated volume name.

Upgrade guidance pulls or rebuilds the desired image, stops the service, creates a backup, and
recreates the application with the existing volume. Startup migrations remain the only schema
upgrade mechanism. Rollback to an older image is not promised after new migrations; restore the
pre-upgrade backup when compatibility is uncertain.

**Alternatives considered:** Copying live DuckDB files was rejected because it cannot be documented
as a consistent backup while the sole writer is active. Adding a backup HTTP API was rejected as a
separate product capability. Automatic destructive rollback was rejected because migrations are
forward-owned and user data must not be silently rewritten.

### 8. Keep container verification explicit and disposable

Add a root `verify:container` command that calls a Node.js orchestration script using ordinary
Docker/Compose CLI commands. It builds the real image under a unique project name, creates a
temporary synthetic session directory and disposable named volume, starts the deployment, waits
for health, and checks frontend root/deep routes, API behavior, session ingestion, non-root identity,
read-only input, and persisted data after recreation. It then requests a normal stop, verifies the
exit, and tears down the temporary project and volume in `finally` cleanup.

The existing `npm run verify` remains Docker-independent. CI can add a separate container job on a
runner with Docker. Authored backend tests separately cover frontend middleware ordering and
missing/invalid static-path behavior without building an image.

**Alternatives considered:** Adding Docker to every verification run was rejected because it would
raise the development prerequisite and slow unrelated changes. Checking only `docker compose
config` was rejected because it misses native module, permissions, signal, static-serving, and
persistence failures. Using production developer data in smoke tests was rejected for privacy and
repeatability.

## Risks / Trade-offs

- **[The native DuckDB package lacks a binary for a selected architecture]** → Use the supported
  Debian/glibc Node 24 matrix and make the container smoke fail during image startup rather than
  fall back silently; multi-platform publication remains out of scope.
- **[Host bind-mount permissions prevent the non-root user from reading sessions]** → Document a
  preflight read check and narrow permission remedies, and surface the exact mounted root as
  unavailable without recommending root execution.
- **[A broad SPA fallback hides backend mistakes]** → Apply it only after the `/api` boundary and
  static lookup, and only for safe HTML navigation requests.
- **[The dashboard changes its internal source structure while this change is implemented]** →
  Depend only on the stable Vite output contract `frontend/dist`; defer final container smoke until
  the dashboard production build is complete.
- **[Named-volume backup commands are easy to run against the wrong Compose project]** → Resolve
  and display the effective volume name before copying and require the application service to be
  stopped.
- **[Read-only root filesystem exposes an unexpected runtime write]** → Provide bounded `/tmp`,
  keep DuckDB under the data volume, and let smoke testing catch any other undeclared write need.
- **[Health becomes slow during a large first backfill]** → Distinguish container start period from
  steady-state interval and keep health tied to completed initialization instead of weakening it.
- **[A newer migration prevents binary rollback]** → Require a pre-upgrade stopped backup and
  document restore as the safe rollback path.

## Migration Plan

1. Add and test optional production-frontend path validation and static/SPA middleware while
   retaining API-only startup as the default.
2. Add production packaging commands, `.dockerignore`, and the multi-stage image; verify the
   compiled backend, pricing catalog, migrations, frontend bundle, and native DuckDB load.
3. Add the hardened one-service Compose definition and environment example with loopback port,
   read-only sessions bind mount, named data volume, health check, and stop grace period.
4. Add the disposable container verification script and run it against synthetic data on the
   supported development and CI platforms.
5. Document setup, mount permissions, startup, health, troubleshooting, backup, restore, upgrade,
   and rollback; perform final image verification after the dashboard production build is ready.

The schema does not change in this proposal. Existing source-run users continue with the same
commands and default API-only backend behavior. To roll back the packaging change, stop and remove
the container while retaining the named data volume, then run the prior source version or image
against a compatible database. If a later image has applied incompatible migrations, restore the
pre-upgrade backup before using an older image.
