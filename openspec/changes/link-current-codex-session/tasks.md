## 1. Authored API Contract

- [x] 1.1 Add a required relink request model containing a validated `issueIdentifier`.
- [x] 1.2 Update the sessions controller relink operation to accept the path `sessionId` and request
  body `issueIdentifier` as its only logical inputs.
- [x] 1.3 Update authored success and error documentation for invalid identifiers, missing sessions,
  exact Linear resolution failures, and preserved previous links.

## 2. Backend Relink Behavior

- [x] 2.1 Change the coordinator and relink service signatures to accept an explicit issue
  identifier.
- [x] 2.2 Normalize and validate the supplied identifier, resolve it exactly through the existing
  Linear reader, and reject identifier mismatches.
- [x] 2.3 Remove current-title parsing and stale-title checks from explicit relinking while retaining
  session-existence checks and automatic-attribution title safeguards.
- [x] 2.4 Preserve the previous link on lookup or persistence failure and commit successful initial
  links, replacements, and idempotent repeats atomically.
- [x] 2.5 Add backend service and HTTP regression tests for initial link, replacement, idempotency,
  invalid input, missing session, not found, mismatch, transient failure, and atomic preservation.

## 3. Generated Contract and Frontend

- [x] 3.1 Run `npm run generate:api` to regenerate tsoa routes, OpenAPI, and the frontend RTK Query
  client from the authored request model.
- [x] 3.2 Update the sessions UI relink mutation to send its displayed candidate identifier
  explicitly while retaining UI-level replacement confirmation.
- [x] 3.3 Update frontend tests for the required mutation body and regenerated hook signature.
- [x] 3.4 Verify generated artifacts are fresh and contain no unrelated manual edits.

## 4. Skill Simplification

- [x] 4.1 Rewrite `SKILL.md` around explicit ticket input, host-provided current session identity,
  one observer mutation, and concise API result rendering.
- [x] 4.2 Remove title-based discovery, inspect/confirm/re-inspect orchestration, ingestion polling,
  rescanning, custom outcome classification, and duplicate response validation.
- [x] 4.3 Remove `scripts/link-current-session.mjs`, its state-machine test suite, and obsolete root
  skill-test wiring.
- [x] 4.4 Update the skill metadata prompt to show invocation with an explicit issue identifier.

## 5. Documentation and Verification

- [x] 5.1 Update README examples to show the required relink body and
  `$link-current-session ENG-215` invocation.
- [x] 5.2 Document that explicit linking is independent of the session title while automatic initial
  attribution may still use a valid title candidate.
- [x] 5.3 Run formatting, linting, type checking, workspace tests, builds, smoke checks,
  and strict OpenSpec validation.
- [x] 5.4 Manually verify successful linking, replacement, idempotent repeat, missing ingestion,
  unavailable observer, and preserved attribution after Linear failure using anonymized data.

## 6. DuckDB Multi-Session Link Correction

- [x] 6.1 Remove the `linear_session_attributions.linear_id` foreign key from the development
  schema while preserving its index and attribution integrity checks.
- [x] 6.2 Add repository and HTTP regressions that refresh an already-referenced issue and link two
  distinct sessions to the same issue.
- [x] 6.3 Add coordinator regression coverage for refreshing cached issue metadata after a link
  exists.
- [x] 6.4 Reset the development database, run focused backend verification, and complete strict
  repository and OpenSpec validation.
