## 1. Production frontend hosting

- [ ] 1.1 Add optional `FRONTEND_DIST_PATH` configuration with startup validation for a readable directory and entry document, preserving API-only startup when it is unset.
- [ ] 1.2 Add authored backend static-asset and SPA-fallback composition after generated API routing, with separate `/api` and generic JSON not-found boundaries.
- [ ] 1.3 Configure safe cache behavior for fingerprinted assets and the frontend entry document, disable dotfile and directory exposure, and restrict fallback to eligible HTML navigation methods.
- [ ] 1.4 Add mirrored backend tests for API-only mode, configured frontend root and assets, direct client routes, unknown API routes, unsafe methods, unacceptable content types, missing entry document, and static read failures.
- [ ] 1.5 Extend compiled-backend smoke coverage to prove optional production frontend serving works without changing generated routes or requiring frontend assets for independent backend startup.

## 2. Reproducible production image

- [ ] 2.1 Add a root `.dockerignore` excluding dependencies, build output, tests not required by the build, repository metadata, environment files, local databases, Codex data, coverage, and other local state from the build context.
- [ ] 2.2 Add a pinned Node.js 24 Debian-slim multi-stage Dockerfile that installs locked workspace dependencies, builds both applications, and creates a production-dependency layer compatible with native DuckDB.
- [ ] 2.3 Assemble the runtime image with compiled backend output, copied migrations, pricing configuration, frontend bundle, package metadata, and production dependencies at the designed fixed paths.
- [ ] 2.4 Create and select a non-root runtime identity, pre-create the writable data and temporary directories with correct ownership, and run the Node.js server directly without Bun or a shell supervisor.
- [ ] 2.5 Add image-level assertions or inspection helpers proving required artifacts exist while TypeScript source, development dependencies, Bun, `.env`, local databases, and Codex content are absent.

## 3. Hardened Docker Compose operation

- [ ] 3.1 Update the environment example with clearly separated host-side `CODEX_SESSIONS_PATH` and published-port substitution plus optional runtime Linear and tuning settings, without adding credentials.
- [ ] 3.2 Add a one-service Compose definition with fixed internal paths, loopback-only port publishing, required read-only Codex sessions bind mount, and a named writable application-data volume.
- [ ] 3.3 Configure the service with a read-only root filesystem, bounded `/tmp` tmpfs, dropped capabilities, no-new-privileges, non-root execution, minimal init, and a documented stop grace period.
- [ ] 3.4 Add a Node-powered `/api/health` container health check with startup timing appropriate for initialization and first backfill.
- [ ] 3.5 Add deterministic Compose-configuration validation proving required host substitution, one-service topology, no database service, loopback binding, mount modes, security settings, and fixed application paths.

## 4. Disposable container verification

- [ ] 4.1 Add a root `verify:container` command and Node.js orchestrator that creates a unique Compose project, synthetic temporary Codex session directory, disposable data volume, and guaranteed cleanup without touching developer data.
- [ ] 4.2 Make container verification build the real image, wait for healthy startup, and assert native DuckDB initialization, API health, frontend root/assets, direct client routes, and JSON isolation for unknown API requests.
- [ ] 4.3 Verify synthetic session ingestion and accounting through the API while proving the mounted session directory and image filesystem reject application writes and the process effective user ID is non-zero.
- [ ] 4.4 Stop the service through the normal container signal, assert exit within the grace period without forced termination, recreate it with the same volume, and verify committed data remains queryable.
- [ ] 4.5 Exercise fresh-volume initialization and a non-writable or otherwise invalid data configuration to prove migrations precede health and startup failures never become healthy.

## 5. Local operations documentation

- [ ] 5.1 Document prerequisites, environment setup, exact Codex sessions path selection, image build, first Compose start, health inspection, logs, stop, restart, and data-volume retention.
- [ ] 5.2 Document Docker Desktop and Linux bind-mount permission checks, unavailable-root diagnosis, narrow read-access remedies, port conflicts, invalid configuration, unhealthy startup, and native dependency troubleshooting without recommending root execution.
- [ ] 5.3 Document a stopped-service backup workflow that resolves the effective named volume, archives it to an explicit host destination, verifies the output, and restarts the application.
- [ ] 5.4 Document restore into an empty or deliberately selected volume plus image upgrade, pre-upgrade backup, startup migration, compatibility, and backup-based rollback procedures.
- [ ] 5.5 Update root and backend documentation with the same-origin production model, API/SPA fallback boundary, runtime secret handling, single-writer invariant, and explicit warning that public network exposure is unsupported.

## 6. Integration and release verification

- [ ] 6.1 Reconcile the image only with the stable `frontend/dist` output from `build-usage-dashboard`, resolve any production deep-link or asset-base defects, and avoid changes to dashboard feature behavior.
- [ ] 6.2 Run focused backend configuration, static-serving, error-boundary, compiled-server, and graceful-shutdown tests followed by generated-file verification, formatting, lint, type checking, all Bun tests, application builds, and backend smoke verification.
- [ ] 6.3 Run the Docker-independent default verification without Docker to confirm the existing contributor workflow remains intact.
- [ ] 6.4 Run the full container verification on supported Docker Desktop and Docker-capable CI platforms, record platform results, and resolve native module, mount-permission, health, persistence, or shutdown regressions before completion.
