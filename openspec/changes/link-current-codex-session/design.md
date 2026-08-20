## Context

See `proposal.md` for motivation and
`specs/codex-session-linking-workflow/spec.md` for observable behavior.

The observer already imports the stable Codex session identifier from Desktop JSONL, exposes
session detail at `GET /api/sessions/{sessionId}`, accepts an ingestion rescan at
`POST /api/imports/rescan`, and performs title-derived atomic attribution through
`POST /api/sessions/{sessionId}/relink`. The relink service re-reads the imported title, resolves
the exact Linear identifier, and preserves committed attribution if validation or resolution
fails.

Codex can expose task-management capabilities to the agent running a skill, but a portable
host-independent environment variable for the current task identifier is not part of the skill
contract. The integration therefore needs a clean boundary between Codex-host task discovery and
deterministic observer HTTP operations. The repository uses Node.js 24 at runtime and Bun only for
tests.

## Goals / Non-Goals

**Goals:**

- Make the common path one explicit `$link-current-session` invocation from the relevant task.
- Keep the stable session identifier visible across task discovery, API calls, and results.
- Make inspection and mutation separate so a changed committed link receives informed
  confirmation.
- Produce deterministic, sanitized results that a skill can render without interpreting prose.
- Run directly from the checked-out repository without building application workspaces.

**Non-Goals:**

- Starting or controlling the observer process from the skill.
- Embedding a Codex App Server client, an MCP client, or Linear SDK access in the script.
- Providing an interactive general-purpose session picker or issue picker.
- Generating a second frontend-style API client for the skill.

## Decisions

### 1. Use an explicit repository skill as the orchestration layer

The change will add `.agents/skills/link-current-session/SKILL.md` and
`.agents/skills/link-current-session/agents/openai.yaml`. The skill metadata will set
`allow_implicit_invocation: false`, and its instructions will own host interaction, user-facing
preflight, confirmation, and result rendering.

The skill is the right boundary because Codex owns task context and task-discovery tools. A small
workflow is also easier to review before generalizing the observer into a tool server.

Alternatives rejected:

- **MCP server now:** adds transport, lifecycle, configuration, and tool-schema work for one
  mutation that is already available over HTTP.
- **Automatic title linking on every invocation or turn:** obscures user intent and is unsafe when
  an existing committed link differs from the title candidate.
- **Linear connector or plugin:** would split resolution and credentials away from the backend and
  violate the existing ownership boundary.

### 2. Keep Codex task discovery out of the deterministic script

The skill will prefer a stable current-task identifier supplied by the Codex host. If unavailable,
it will use available Codex task discovery constrained by the current repository and expected
title. A unique match is acceptable; zero or multiple matches require an explicit identifier or
user selection. Recency is never a tie-breaker.

The observer script will require `--session-id`. It will not query App Server, inspect Codex state
directories, or parse task lists. This makes the script testable and avoids coupling it to a
particular Codex surface or app-server lifecycle.

Alternative rejected: launching or connecting to Codex App Server from the script. That would
duplicate host capabilities, introduce a second protocol boundary, and still would not prove
which of several identically named tasks contains the invocation.

### 3. Use a two-phase inspect and commit protocol

One executable ESM script will expose two commands:

```text
node scripts/link-current-session.mjs inspect --session-id <id> [--observer-url <url>]
node scripts/link-current-session.mjs link --session-id <id> --expected-candidate <key>
  [--confirm-replace-from <key>] [--observer-url <url>]
```

`inspect` performs bounded readiness handling and returns the imported title, candidate, phase,
committed link, and one of `ready_to_link`, `already_linked`, `confirmation_required`, or an error
outcome. The skill renders this preflight. An unlinked candidate can proceed under the original
explicit invocation; a different committed issue pauses for confirmation.

`link` fetches session detail again and verifies that the candidate and, when applicable, the
confirmed previous link still match the inspect result. It then calls the existing relink
endpoint. The backend remains authoritative for title-stability checks during Linear resolution
and for the atomic commit.

Alternatives rejected:

- **A single command that always mutates:** cannot provide meaningful confirmation for replacement.
- **Interactive prompts inside the Node script:** do not compose reliably with Codex tool
  execution and are harder to test than explicit arguments and structured results.
- **Supplying the issue identifier in a relink request body:** would create a second attribution
  source and bypass the developer-controlled current title.

### 4. Bound ingestion recovery and network work

The script will first request session detail. A `404` for a syntactically valid stable identifier
starts a short bounded poll to allow the existing watcher to commit the active task. If the session
is still absent, the script requests one rescan and polls for a bounded total duration. It will not
rescan for connection failures, invalid responses, or non-404 API errors.

Each HTTP request uses an abort timeout. Timing constants are exported or injected so Bun tests can
exercise the state machine without wall-clock delays. Exhaustion produces `session_not_imported`;
users may fix configuration or invoke the workflow again.

Alternatives rejected:

- **Unbounded polling:** can leave a Codex turn hanging and conceal a wrong sessions mount.
- **Repeated rescans:** creates unnecessary full discovery work and still cannot repair an invalid
  source path.
- **Reading the JSONL directly as a fallback:** duplicates ingestion and bypasses committed
  observer state.

### 5. Consume the existing HTTP contract with a narrow runtime-validated client

The script will use Node's built-in `fetch` and validate only fields needed from session, rescan,
relink, and error responses. It will not import backend source or the browser-oriented generated
RTK Query client. Contract-focused tests will exercise the client against representative OpenAPI
responses and reject malformed or HTML responses as `observer_protocol_error`.

No backend route or generated file should change. If implementation discovers that a required
safety precondition cannot be expressed with the current API, that is a scope change and the
proposal must be revised before modifying the contract.

Alternative rejected: hand-maintaining full copies of backend response models. Narrow validators
reduce drift surface while retaining runtime protection at the process boundary.

### 6. Emit one structured result and stable exit classes

The script writes exactly one JSON result to stdout. Incidental diagnostics, if any, go to stderr
and never include raw response bodies. The result contains a version, outcome, stable session
identifier, permitted attribution summary when available, and bounded guidance.

Outcomes are grouped as:

| Class | Representative outcomes |
| --- | --- |
| Success | `ready_to_link`, `already_linked`, `linked`, `relinked` |
| User action | `confirmation_required`, `invalid_title`, `stale_preflight` |
| Readiness | `session_not_imported`, `observer_unavailable` |
| Server rejection | `linear_unconfigured`, `linear_not_found`, `linear_failure` |
| Contract/configuration | `invalid_arguments`, `invalid_observer_url`, `observer_protocol_error` |

Exit status `0` represents completed success or a successful preflight, `2` represents a safe
user-action outcome, and `1` represents configuration, readiness, protocol, or server failure.
The skill branches on `outcome`, not on English text.

### 7. Configure one safe observer origin

Observer URL precedence is command argument, `AI_TASK_OBSERVER_URL`, then
`http://127.0.0.1:3000`. Only `http:` and `https:` URLs without embedded credentials are accepted.
The normalized origin is reused for every request in an invocation; redirects are not used to
switch origins. Linear credentials are neither accepted nor read.

The loopback default works with `npm run dev` and the planned single-container deployment. An
explicit override supports a different local port or a deliberately configured remote observer
without making deployment a prerequisite.

### 8. Keep the skill self-contained and test it through the root workflow

The implementation layout will be:

```text
.agents/skills/link-current-session/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── link-current-session.mjs
└── __tests__/
    └── scripts/
        └── link-current-session.test.ts
```

The test tree mirrors the authored script. A root `test:skills` command will run these tests with
Bun, and the existing root `test`/`verify` chain will include it before workspace tests. Tests use a
stub HTTP boundary and injected timing rather than real Codex files, DuckDB, or Linear.

## Risks / Trade-offs

- **[Current task identity is not exposed on a Codex surface]** → Fall back to repository-and-title
  discovery only when unique, then require an explicit stable identifier rather than guessing.
- **[The active JSONL has not flushed enough metadata for ingestion]** → Bound polling and one
  rescan, explain the sessions-path dependency, and allow a later explicit retry.
- **[State changes after preflight]** → Re-fetch and compare the expected candidate and previous
  link immediately before mutation; rely on the backend's existing title-stability and atomic
  relink checks.
- **[Backend response shape drifts]** → Validate the narrow consumed shape at runtime and cover
  representative success and error payloads in contract-focused tests.
- **[A configured remote observer exposes session metadata over the network]** → Default to
  loopback, require an explicit URL override, accept HTTPS, reject embedded credentials, and emit
  only permitted summaries.
- **[Codex does not immediately notice the checked-in skill]** → Document skill discovery and the
  possible need to restart or open a new task after installation.

## Migration Plan

1. Add the repository skill, metadata, deterministic script, fixtures, and Bun tests.
2. Add the skill test command to the root verification path.
3. Document invocation, observer configuration, duplicate-title handling, confirmation, and
   failure recovery.
4. Verify against a running development observer using an anonymized task titled with a test
   Linear identifier.

There is no data migration, generated API update, or deployment-order requirement. Rollback removes
the skill directory and root skill-test command; existing observer attribution remains intact.
