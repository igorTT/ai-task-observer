## 1. Skill Contract and Structure

- [ ] 1.1 Create `.agents/skills/link-current-session/` with `SKILL.md`,
  `agents/openai.yaml`, `scripts/`, and a mirrored `__tests__/scripts/` tree.
- [ ] 1.2 Configure the skill metadata for explicit-only `$link-current-session` invocation and
  document its narrow purpose, required observer process, and prohibited direct data access.
- [ ] 1.3 Write the skill workflow to prefer host-provided current-task identity, fall back to
  repository-and-title discovery only when unique, and stop for an explicit identifier on zero or
  duplicate matches.
- [ ] 1.4 Define the skill's inspect, confirmation, link, and result-rendering steps, including the
  rule that a differing committed issue link requires a second user confirmation.

## 2. Deterministic Observer Script Foundation

- [ ] 2.1 Implement command and argument parsing for `inspect` and `link`, including required
  session identity, expected candidate, and confirmed previous-link inputs.
- [ ] 2.2 Implement observer URL precedence from command argument, `AI_TASK_OBSERVER_URL`, and the
  loopback default, with protocol, embedded-credential, and redirect-origin validation.
- [ ] 2.3 Implement the versioned structured result schema, stable outcome categories, stdout/stderr
  separation, and documented exit status classes.
- [ ] 2.4 Add bounded request execution using Node's built-in `fetch`, abort timeouts, safe URL path
  construction, and sanitized transport failure mapping.
- [ ] 2.5 Add narrow runtime validators for the consumed session detail, rescan, relink, and API
  error payloads without copying complete backend models or importing generated files.

## 3. Inspection and Ingestion Readiness

- [ ] 3.1 Implement direct session inspection that returns imported title, candidate, phase,
  committed issue summary, and stable session identity.
- [ ] 3.2 Implement bounded polling for an initially unknown session and continue without a rescan
  when watcher ingestion completes in time.
- [ ] 3.3 Implement at most one explicit rescan followed by bounded polling, and return
  `session_not_imported` when the selected identity remains unknown.
- [ ] 3.4 Classify inspection as `ready_to_link`, `already_linked`, `confirmation_required`, or
  `invalid_title` without performing a relink mutation.

## 4. Safe Link and Relink Execution

- [ ] 4.1 Re-inspect immediately before mutation and reject changed candidate or previous-link
  expectations as `stale_preflight`.
- [ ] 4.2 Require a matching confirmed previous issue identifier when the current committed link
  differs from the title candidate, while allowing an unlinked candidate to proceed from the
  original explicit invocation.
- [ ] 4.3 Invoke the existing session relink endpoint with only the encoded stable session
  identifier and report `linked` or `relinked` from the committed response.
- [ ] 4.4 Map unconfigured Linear, missing issue, stale title, retryable Linear failures, rejected
  responses, and malformed observer responses to stable sanitized outcomes without automatic
  mutation retries.
- [ ] 4.5 Ensure script inputs, outputs, and diagnostics cannot accept or expose Linear credentials,
  raw response bodies, session messages, reasoning, or tool data.

## 5. Automated Verification

- [ ] 5.1 Add Bun tests for command parsing, observer URL precedence and rejection, output schema,
  exit statuses, encoded session paths, request timeouts, and redirect handling.
- [ ] 5.2 Add inspect tests for valid unlinked candidates, phases, already-linked sessions,
  differing links, invalid titles, and malformed contract payloads.
- [ ] 5.3 Add readiness tests for watcher success before rescan, one coalesced rescan, exhaustion,
  observer unavailability, non-404 API errors, and bounded retry counts using injected timing.
- [ ] 5.4 Add link tests for successful initial linking, confirmed replacement, missing or mismatched
  confirmation, changed preflight state, stale backend title, and every documented Linear failure
  class.
- [ ] 5.5 Add tests that assert duplicate-title skill guidance never selects by recency, metadata
  disables implicit invocation, and emitted errors contain no fixture secrets or raw payloads.
- [ ] 5.6 Add a root `test:skills` command, include it in the existing root `test` and `verify`
  paths, and keep Bun limited to test execution.

## 6. Documentation and End-to-End Validation

- [ ] 6.1 Document `$link-current-session`, the `ENG-215: phase` title convention, observer startup,
  `AI_TASK_OBSERVER_URL`, explicit session-ID recovery, confirmation, and common failure guidance.
- [ ] 6.2 Document that the workflow requires no MCP or Linear plugin, never writes to Linear, and
  can run against the development observer before Docker packaging is complete.
- [ ] 6.3 Validate the skill structure and explicit invocation metadata, then manually exercise a
  unique current task, duplicate-title refusal, delayed import, already-linked no-op, and confirmed
  relink against a local observer using anonymized data.
- [ ] 6.4 Run formatting, linting, type checking, skill tests, workspace tests, builds, smoke checks,
  and strict OpenSpec validation; confirm no generated API or database artifacts changed.
