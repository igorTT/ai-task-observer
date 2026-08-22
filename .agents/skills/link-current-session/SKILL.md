---
name: link-current-session
description: Explicitly inspect and link the current Codex task through the local AI Task Observer.
---

# Link the current Codex session

This skill is explicit-only. Run it only when the developer invokes `$link-current-session`; a
similar request in an ordinary prompt does not activate it.

The observer is the only owner of Codex ingestion, DuckDB writes, Linear credentials, and Linear
lookups. Never read Codex JSONL files or session state, open DuckDB, call Linear, use an MCP or
Linear plugin, accept credentials, or send message content, reasoning, tool data, or raw HTTP
responses to the user.

## Resolve identity

1. Prefer the stable identifier supplied by the Codex host for the task containing this
   invocation. Use it directly; do not search for another task when it is available.
2. If the host does not expose that identifier, use the host's task-discovery capability with the
   current repository and the expected title as constraints. A single eligible match is allowed.
   Report that discovery was used.
3. Never use recency, newest-update order, or a title alone as a tie-breaker. For zero or duplicate
   matches, stop and ask the developer to provide an exact stable session identifier. Identify
   duplicate candidates only with safe stable metadata; do not expose session content.

The deterministic script deliberately accepts only `--session-id`. If host identity or safe
discovery is unavailable, the explicit recovery command is:

```text
node .agents/skills/link-current-session/scripts/link-current-session.mjs inspect --session-id <exact-id>
```

Use the repository's Node 24 runtime. The observer URL is the command option, then
`AI_TASK_OBSERVER_URL`, then `http://127.0.0.1:3000`. If the observer is not running, tell the
developer to start it with `npm run dev` and retry; do not start or replace it from this skill.

## Inspect, confirm, and link

First run `inspect` with the resolved stable ID. Show the script's structured result in concise
user-facing language: imported title, parsed issue candidate, optional phase, committed issue (if
any), and the stable session ID. Branch on `outcome`, never on incidental prose.

- `ready_to_link`: run `link` with `--expected-candidate` from the inspect result. An unlinked
  candidate is allowed to proceed under this original explicit invocation.
- `already_linked`: report the idempotent no-op and do not call `link`.
- `confirmation_required`: show both issue identifiers and ask whether to replace the committed
  issue. Only after an explicit yes, run `link` with the candidate and
  `--confirm-replace-from` set to the committed issue identifier. A decline or missing answer
  preserves the current link.
- `invalid_title`, `session_not_imported`, `observer_unavailable`, or another failure: report the
  bounded guidance and stop without mutation.

The `link` command re-inspects immediately before mutation. If the title candidate or confirmed
previous issue differs, report `stale_preflight` and ask the developer to inspect again. Never
retry a mutation automatically. The observer re-reads the title, resolves the exact issue, and
commits the link atomically, so do not supply an arbitrary issue identifier or call another
service.

Render only the permitted summary from the result. Do not echo command arguments, environment
values, URLs containing credentials, response bodies, or diagnostics. In particular, never expose
Linear credentials even if a developer attempts to pass them; tell them to configure Linear on the
observer instead.
