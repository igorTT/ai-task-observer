## Context

See `proposal.md` for motivation and `specs/linear-session-attribution/spec.md` for required behavior. A Codex chat normally enters the system with a default title and remains unlinked. After the developer identifies its ticket, they manually rename the chat to the issue-title convention, which can establish the initial link. Once stored, that link is independent of later title changes: a rename produces a candidate for user review but cannot move or clear the link without an explicit relink request. The archived ingestion capability already persists stable session IDs and current titles in `codex_sessions`; its importer returns the IDs touched by each committed source update. The backend owns one DuckDB connection, generated tsoa routes form the frontend boundary, and backend startup must remain usable without Linear credentials.

Attribution crosses configuration, an external SDK, ingestion notifications, persistence, session response composition, background work, and shutdown. Remote Linear requests must never run inside an ingestion transaction, and a failed remote request must not damage committed session or usage data.

## Goals / Non-Goals

**Goals:**

- Add a deterministic and independently testable title parser.
- Preserve established links across title changes and make replacement an explicit user action.
- Keep the Linear SDK behind an application-owned, read-only adapter.
- Persist current attribution separately from ingestion-owned session facts.
- Make reconciliation crash-safe through durable comparison with the current session title rather than relying only on in-memory events.
- Serialize attribution persistence with other transactional DuckDB writes.
- Extend the authored tsoa contract without allowing generated code to become a source of behavior.

**Non-Goals:**

- Maintaining attribution history or supporting more than one current issue per session.
- Downloading full Linear issue content or mirroring a Linear workspace.
- Polling Linear continuously for real-time issue changes.
- Defining issue-level usage queries, cost calculations, or frontend screens.
- Introducing a general event bus, job server, or separate worker process.
- Automatically moving or clearing an established issue link because the Codex title changed.

## Decisions

### 1. Parse one exact title grammar in a pure module

The current Codex chat title is the source of a proposed candidate, not the continuing source of truth for an established link. The parser does not distinguish a platform-generated title from any other non-matching title: it returns no candidate until the developer renames the chat to the exact convention. It also does not attempt to determine the ticket from chat content, repository state, branch names, or Linear metadata.

The parser accepts the trimmed grammar:

```text
<team-key>-<positive-integer>[ : <phase>]
```

The team key begins with an ASCII letter and continues with ASCII letters or digits. The identifier is normalized to uppercase. The phase is trimmed, blank becomes absent, and phase contents do not affect whether the issue identifier is valid. Any additional text without the colon makes the title unlinked.

The parser returns either `{ candidateIdentifier, phase? }` or a no-candidate result and never calls Linear. For a session without a stored link, the candidate is eligible for initial automatic resolution. For a linked session, it is informational until the user explicitly requests relinking.

**Alternatives considered:**

- Searching for an identifier anywhere in the title was rejected because it can silently associate conversational text with an issue.
- Fuzzy or model-based matching was rejected because the title convention is already the user's authoritative control surface.
- Restricting phase values to `explore`, `apply`, and `verify` was rejected because phases are optional metadata, not the core attribution contract.
- Automatically treating every parsed title change as authoritative was rejected because a persisted usage attribution must not move between tickets without an explicit user decision.

### 2. Keep Linear credentials optional and isolate the SDK behind an adapter

`LINEAR_API_KEY` is optional configuration. Absence creates an `unconfigured` integration that makes no remote calls and does not affect process health. A configured value constructs one SDK client for the backend lifecycle.

An application-owned `LinearIssueReader` interface exposes only exact issue lookup and maps SDK results immediately into a minimal issue summary. Error translation classifies authentication, not-found, rate-limit, timeout/network, and upstream-server failures without returning raw SDK errors beyond the adapter.

The adapter only uses Linear read operations. The requested identifier and returned identifier are normalized and compared before a link is accepted.

**Alternatives considered:**

- Calling the SDK directly from controllers or repositories was rejected because it couples transport, persistence, error sanitization, and tests.
- Requiring credentials at startup was rejected because the foundation and ingestion capabilities explicitly operate without Linear.
- OAuth and multi-user credential storage were rejected for the local-first initial product; the API key remains process configuration.

### 3. Use three additive persistence tables

Migration `003_linear-session-attribution.sql` adds:

1. `linear_issues`: one privacy-safe cache row per Linear ID, including identifier, title, URL, team summary, workflow-state summary, Linear update time, and local sync time.
2. `linear_session_attributions`: one row per `codex_sessions.session_id`, containing the title fingerprint, current title candidate identifier, optional phase, resolution status, optional independently stored Linear ID, attempt/success timestamps, and a sanitized failure category.
3. `linear_sync_runs`: durable startup/manual/event run status and outcome counts for the status API.

Resolution status uses the closed set `unlinked`, `unconfigured`, `pending`, `linked`, `not_found`, and `error`. Candidate state and committed link identity are mapped separately, so a linked row may expose a different current title candidate while retaining its Linear ID. A failed refresh or relink attempt retains `linked` and its Linear ID while recording the latest sanitized attempt outcome separately; transient infrastructure failure must not erase a valid link.

SQL migrations remain the physical schema source of truth. Passive models describe rows, repositories own parameterized statements and mappings, and the attribution module owns state transitions. The ingestion repository does not gain Linear columns.

**Alternatives considered:**

- Adding Linear fields directly to `codex_sessions` was rejected because ingestion owns that table and must remain independently usable.
- Storing issue metadata only in memory was rejected because restarts would lose links and force unnecessary remote calls.
- Storing full SDK responses as JSON was rejected for privacy, schema stability, and queryability.
- Maintaining an attribution-history table was deferred because the product currently needs only the title-controlled current link.

### 4. Reconcile from durable state and use ingestion notifications only as an optimization

An `AttributionCoordinator` owns a coalescing work queue. After a source import or later title update commits, the ingestion coordinator passes the importer-returned touched session IDs to a callback; the attribution coordinator then loads their current titles and evaluates them. An unlinked default-title session becomes eligible for initial resolution after the developer renames it. For an already linked session, the same path updates its title fingerprint, candidate, and phase only; it never replaces or clears the stored Linear ID. Network resolution occurs outside DuckDB transactions.

Correctness does not depend on that callback. At startup and during explicit synchronization, reconciliation compares every eligible session with its attribution row and title fingerprint. Missing or changed rows are reparsed, but changed candidates on linked rows remain informational. Not-found and retryable unlinked outcomes are eligible for a later manual or startup run. Cached linked issues older than the configured cache TTL are refreshed using their stored Linear identity, not a differing title candidate.

Eligible initial-link candidates are grouped by normalized identifier, in-flight lookups are coalesced, and distinct lookups use bounded concurrency. One lookup result can update the issue cache and all still-unlinked sessions whose current candidate still matches that identifier. Before committing a result, the coordinator rechecks each session's title fingerprint and absence of an established link so a slow response cannot apply an obsolete title or overwrite a user-controlled link.

An explicit relink command loads the session's current title candidate and fingerprint, rejects a missing or invalid candidate, and resolves the candidate through `LinearIssueReader` outside a transaction. On success, a short exclusive-write transaction rechecks the fingerprint and atomically replaces the stored Linear ID. Not-found, authentication, mismatch, and transient failures are returned as sanitized outcomes while the previous link remains unchanged.

Startup initializes the coordinator and queues reconciliation without waiting for the full remote sweep before the HTTP listener becomes available. Manual sync returns a durable run ID and coalesces with an active run. Authentication failure stops further lookups in that run; transient failures remain per-candidate retryable outcomes.

**Alternatives considered:**

- Resolving Linear inside the session-import transaction was rejected because network latency and failure would block or roll back privacy-safe ingestion.
- Depending only on in-memory import events was rejected because a crash between import commit and notification would permanently miss attribution.
- A periodic full poll was rejected for the initial product because startup, title events, cache TTL, and explicit sync cover the required behavior with less background traffic.
- Automatically relinking during reconciliation was rejected because synchronization is an operational refresh, not evidence of user intent to move historical usage between issues.

### 5. Add one shared transactional write gate

The backend process remains DuckDB's sole writable owner. To prevent an ingestion transaction and an attribution transaction from interleaving on the shared connection, `AppDatabase` exposes a FIFO exclusive-write operation. Existing transactional ingestion writes and new attribution transactions use that gate; reads and Linear network requests stay outside it.

Attribution batches the issue-cache upsert, current-candidate and stored-link recheck, session-attribution updates, and sync-run counters into short transactions after remote results are available.

**Alternatives considered:**

- A second writable DuckDB process or connection was rejected because it weakens the established single-writer boundary.
- Relying on call timing to avoid overlapping transactions was rejected because file-watch imports and manual synchronization are independently triggered.
- Holding the write gate while calling Linear was rejected because it would stall ingestion and API mutations on external latency.

### 6. Compose attribution into the existing session API

The session query service obtains session facts and current attribution through repositories and maps them into authored API models. Session list and detail responses gain an `attribution` object containing status, candidate identifier, optional phase, optional minimal issue summary, last attempt/success times, and sanitized failure category.

A new authored `LinearController` exposes:

- `GET /api/linear/status`
- `POST /api/linear/sync`

The authored session-attribution API additionally exposes:

- `POST /api/sessions/{sessionId}/relink`

The relink operation has no arbitrary issue-ID body: it uses the session's current parsed title candidate, making the developer's rename visible while still requiring an explicit confirmation action. Its success response returns the replacement attribution; validation and Linear failures leave the previous link intact.

API dependencies receive narrow coordinator/query interfaces. tsoa continues to generate route registration and the OpenAPI document, and the frontend RTK Query client is regenerated even though frontend screens remain out of scope.

**Alternatives considered:**

- A separate issue-list API was deferred to the issue-usage-accounting change.
- Returning raw SDK models was rejected because it leaks unnecessary data and makes the public contract depend on SDK types.
- A manually maintained OpenAPI file was rejected because the project already treats authored tsoa models and controllers as the contract source.

### 7. Preserve privacy and operational isolation

Logs contain normalized identifiers, run IDs, status categories, counts, and timestamps but never API keys, authorization headers, raw Linear responses, descriptions, or comments. Persisted failure details use a closed sanitized category plus a safe summary when useful.

At shutdown, the attribution coordinator rejects new work, waits for or safely cancels active remote operations, commits only results whose session title remains current, and closes before DuckDB. Ingestion can finish first or concurrently, but both must pass transactional writes through the shared gate.

## Risks / Trade-offs

- **[Linear issue lookup semantics or SDK error shapes change]** → Keep all SDK behavior in the adapter and cover it with contract-shaped mocks and explicit error-classification tests.
- **[A strict title grammar leaves some intended sessions unlinked]** → Expose the parsed status clearly; the user corrects attribution by renaming the Codex session to the documented convention.
- **[Large historical imports create many candidate lookups]** → Group by identifier, reuse fresh cache rows, bound concurrency, and coalesce active runs.
- **[A title changes while an initial-link or relink lookup is in flight]** → Store and recheck the title fingerprint and current stored link before committing the result.
- **[The title candidate differs from a stored link and confuses the user]** → Return candidate and linked issue as separate API fields and expose that explicit relinking is required.
- **[DuckDB transaction contention affects ingestion latency]** → Perform remote work outside the write gate and keep attribution transactions short and batched.
- **[Not-found conflates missing and inaccessible issues]** → Present it as “not found or inaccessible” and allow later explicit retry rather than claiming deletion.
- **[Cached metadata becomes stale without continuous polling]** → Record Linear and local sync timestamps and refresh stale linked candidates at startup or explicit synchronization.

## Migration Plan

1. Add and verify the Linear SDK dependency and optional configuration without enabling synchronization.
2. Apply the additive `003_linear-session-attribution.sql` migration and repository models.
3. Introduce the shared write gate and move existing ingestion transactions through it before attribution writes begin.
4. Add the parser, adapter, coordinator, sticky-link state transitions, and startup/shutdown wiring behind the optional configuration boundary.
5. Extend authored API models/controllers with explicit relinking and regenerate tsoa routes, OpenAPI, and the frontend RTK Query client.
6. On first configured startup, queue a reconciliation sweep for existing sessions; unconfigured installations create no remote traffic.

The schema migration is additive. Rolling back the application can leave the new tables and migration record in place because the previous binary ignores them; restoring a pre-migration database backup is required only if the deployment policy demands physical schema rollback. No Linear-side rollback is needed because the integration is read-only.
