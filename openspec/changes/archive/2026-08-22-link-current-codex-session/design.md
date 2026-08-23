## Context

See `proposal.md` for motivation and
`specs/linear-session-attribution/spec.md` for observable behavior.

The observer currently exposes `POST /api/sessions/{sessionId}/relink` without a request body. The
backend reparses the imported session title to select a Linear candidate, while the Codex skill
performs a separate inspection, duplicates title parsing, polls ingestion, confirms replacement,
and re-inspects before calling that endpoint. The backend already owns Linear access, exact issue
resolution, DuckDB writes, and atomic replacement.

Codex supplies the stable identity of the task containing the skill invocation. The developer can
supply the Linear issue identifier directly. Those are the only values the linking operation needs.

## Goals / Non-Goals

**Goals:**

- Make the common path one explicit skill invocation and one observer mutation.
- Make `sessionId` and `issueIdentifier` the complete linking input.
- Keep validation, exact Linear resolution, failure preservation, and atomic persistence in the
  backend.
- Keep API errors generated, bounded, and safe for direct rendering by the skill.
- Remove title-dependent and ingestion-recovery orchestration from the skill.

**Non-Goals:**

- Changing automatic initial attribution from valid imported titles.
- Adding a general Codex tool server, issue search, or interactive picker.
- Starting or controlling the observer from the skill.
- Moving Linear credentials or DuckDB access outside the backend.

## Decisions

### 1. Make the issue identifier an authored API input

Keep the existing route and add a required JSON request model:

```http
POST /api/sessions/{sessionId}/relink
Content-Type: application/json

{
  "issueIdentifier": "ENG-215"
}
```

The path supplies `sessionId`; the body supplies `issueIdentifier`. The backend normalizes the
identifier to uppercase after syntax validation. No title or previous-link value is accepted.

Keeping the route minimizes surface area and preserves its explicit replacement meaning. Making
the body required is an intentional contract break; every generated client caller must be updated
in the same change.

Alternative rejected: add a parallel endpoint while retaining bodyless relink. Two mutation paths
with different sources of truth would preserve the ambiguity this change is removing.

### 2. Treat the explicit request as replacement authorization

An explicit invocation containing the target ticket is sufficient intent to link or replace. The
backend does not require the current title to match and the skill does not ask for a second
confirmation. Repeating the same request is idempotent.

Alternative rejected: inspect the previous link and require `expectedPreviousIssueIdentifier`.
That adds a third logical input and a client-side compare-and-swap protocol without protecting
Linear or DuckDB from a failure the backend transaction does not already handle.

### 3. Resolve and commit entirely in the backend

The relink service will:

1. Validate and normalize the supplied identifier.
2. Verify that the session exists.
3. Resolve the exact issue through the existing read-only Linear boundary.
4. Reject a returned identifier mismatch.
5. In one exclusive-write transaction, upsert the permitted issue summary and save or replace the
   single session attribution.

Remote work remains outside the DuckDB write transaction. A failed lookup or transaction leaves
the previously committed link unchanged. The persisted attribution candidate becomes the explicit
requested identifier; phase remains title-derived metadata and is not part of this operation.

Alternative rejected: let the skill call Linear before sending a resolved internal ID. That would
move credentials and issue validation across the established ownership boundary.

### 4. Remove title-stability checks from explicit relinking

The target of an explicit relink no longer depends on mutable title state, so title fingerprints
and stale-title checks are irrelevant to this operation. Concurrent title ingestion may update
title-derived candidate or phase metadata, but it cannot change the explicit issue target being
resolved and committed.

The backend still rechecks session existence inside the write transaction. Existing automatic
attribution paths retain their title-fingerprint protections.

Alternative rejected: retain title matching as an additional precondition. That would make the
explicit issue parameter redundant and recreate the original coupling.

### 5. Make the skill declarative and scriptless

`SKILL.md` will instruct Codex to validate one ticket argument, obtain the current stable session
identifier from the host, and send the authored request to the configured observer origin. If host
identity is unavailable, it asks for the exact session identifier rather than searching by title
or recency.

The skill renders success from `SessionRelinkResponse` and maps authored API error codes to concise
guidance. It does not need a custom command parser, polling timers, runtime copies of response
models, structured outcome versioning, or a separate Node executable.

Alternative rejected: retain a smaller wrapper script. One generated API-shaped HTTP request does
not justify maintaining a second client abstraction.

### 6. Preserve one safe observer origin

The observer URL remains `AI_TASK_OBSERVER_URL` with a loopback default of
`http://127.0.0.1:3000`. The skill never accepts URLs containing credentials and never accepts
Linear credentials. Connection failures produce bounded startup guidance.

### 7. Do not enforce the mutable Linear issue cache with a DuckDB foreign key

Keep `linear_session_attributions.linear_id` indexed but do not declare it as a foreign key to
`linear_issues.linear_id`. DuckDB rejects updates to a referenced parent row even when only
non-key cache metadata changes. After one session links to an issue, the existing issue-summary
upsert therefore prevents a second session from linking to that same issue and also prevents
scheduled cache refreshes.

The backend remains the sole DuckDB writer and already upserts the issue summary before saving or
replacing a linked attribution in one exclusive-write transaction. That ordering is the
referential-integrity boundary for this local development database. The existing status and
`linear_id` checks remain, as does the index used by issue-usage queries.

Alternative rejected: skip issue-summary updates with `ON CONFLICT DO NOTHING`. That would unblock
the second link but leave cached metadata and synchronization timestamps permanently stale.

Alternative rejected: detach every referencing attribution before updating the issue and restore
them afterward. DuckDB cannot perform the detach and referenced-row update atomically in one
transaction, so this introduces a crash window in which committed links are absent.

## Risks / Trade-offs

- **[A caller unintentionally replaces an existing link]** → The operation remains explicit and
  includes the exact replacement issue; the UI can provide its own confirmation before calling.
- **[An old generated client calls relink without a body]** → Make the request model required,
  regenerate all API artifacts, and update every caller atomically.
- **[The supplied session has not been ingested]** → Return the existing not-found response and
  let the developer retry; do not hide readiness problems behind skill-side rescans.
- **[Linear resolution fails]** → Preserve the previous link and return an existing sanitized error
  category.
- **[Automatic title attribution and explicit linking race]** → Keep explicit relinking atomic and
  ensure automatic reconciliation never overwrites an established link.
- **[Application code writes a dangling Linear ID after removing the foreign key]** → Preserve the
  single-writer backend boundary, keep issue upsert before attribution persistence, and cover both
  explicit and automatic multi-session linking with repository and service regression tests.

## Migration Plan

1. Add the required authored request model and update the controller and relink service signature.
2. Remove the DuckDB foreign key from attribution `linear_id` in the development schema and reset
   the local database so mutable issue summaries can be refreshed after links exist.
3. Regenerate tsoa routes, OpenAPI, and the frontend RTK Query client.
4. Update frontend callers and backend tests for explicit identifiers and multiple sessions linked
   to one issue.
5. Replace the script-backed skill with narrow instructions and remove obsolete script tests.
6. Update user documentation and run strict OpenSpec and repository verification.

Rollback restores the bodyless title-derived relink contract, generated artifacts, previous skill
directory, and the original development schema. No production data migration or Linear-side
rollback is required.
