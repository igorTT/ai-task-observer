# Roadmap

AI Task Observer is being built as a sequence of independently reviewable capabilities. The first
four milestones establish the complete backend path from Codex Desktop session files to
Linear-issue usage accounting. The remaining milestones add the user interface, local packaging,
and an explicit workflow for linking the current Codex task from inside Codex.

## Progress

Four of the original six milestones are complete. One additional milestone has been added, making
the current roadmap **4 of 7 milestones complete**.

## Milestones

### 1. Establish the project foundation — Complete

- Create the frontend and backend npm workspaces.
- Establish the Node.js, TypeScript, Express, React, Vite, DuckDB, and OpenAPI boundaries.
- Add the shared formatting, linting, testing, build, and verification toolchain.
- Keep Bun limited to the test runner.

### 2. Ingest Codex Desktop sessions — Complete

- Discover and backfill Codex Desktop JSONL session files.
- Watch for incremental changes and resume from durable checkpoints.
- Persist stable session identity, titles, selected events, token observations, and import state.
- Preserve the last committed snapshot when a partial write or rebuild fails.

### 3. Attribute sessions to Linear issues — Complete

- Parse explicit titles such as `ENG-215: explore` without semantic inference.
- Resolve exact issue identifiers through the read-only Linear SDK integration.
- Persist one current issue link per session while keeping title candidates visible.
- Support explicit, atomic relinking without losing previously committed attribution on failure.

### 4. Calculate and aggregate issue usage — Complete

- Normalize session usage observations and developer turns.
- Calculate reproducible model-aware dollar estimates from versioned JSON pricing configuration.
- Aggregate sessions, turns, token categories, models, dates, and estimated cost by current Linear
  issue attribution.
- Expose issue summaries and detailed accounting through the generated OpenAPI contract.

### 5. Build the usage dashboard — Planned

- Build the local React interface using Tailwind CSS and shadcn/ui.
- Show issue-level usage summaries and issue details with their linked sessions.
- Display turns, token categories, estimated cost, model and date breakdowns, completeness, and
  sanitized anomalies.
- Surface unlinked sessions, changed title candidates, import state, and Linear synchronization
  state.
- Use generated RTK Query hooks for server data, Zustand for local UI state, and URL state for
  shareable navigation and filters.

### 6. Package the local deployment — Planned

- Add production Docker and Docker Compose configuration.
- Serve the built frontend from the backend process.
- Mount Codex session directories read-only and store DuckDB in a persistent writable volume.
- Run on a Debian-based Node.js image as a non-root user with health checks and graceful shutdown.
- Document local configuration, credentials, startup, persistence, backup, and upgrade behavior.

### 7. Link the current Codex task from Codex — Planned

- Add an explicitly invoked, script-backed Codex skill such as `$link-current-session`.
- Use the Codex task ID as immutable identity while retaining the title as the developer-controlled
  source of the Linear identifier and optional phase.
- Call the observer server to validate the imported title, resolve the exact Linear issue, and
  persist the durable session-to-issue link.
- Handle duplicate titles, delayed ingestion, an unavailable observer, existing links, and Linear
  failures without silently choosing or replacing attribution.
- Keep the observer backend as the sole owner of Linear access and DuckDB writes.
- Defer an MCP surface until the observer exposes enough Codex-facing operations to justify a
  typed tool layer; the skill workflow can adopt MCP later without changing the user interaction.

## Current delivery order

The planned order is:

1. Build the usage dashboard.
2. Package and document the local deployment.
3. Add the Codex-initiated linking workflow.

The seventh milestone depends on the existing ingestion and Linear-attribution capabilities but is
otherwise independent of the dashboard. It may be moved before deployment if direct linking from
Codex becomes the preferred way to validate the end-to-end local workflow.
