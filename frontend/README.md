# Frontend

The frontend is the local web interface for exploring Codex usage attributed to Linear issues.
It provides a desktop-only React dashboard for viewport widths of at least 1024 CSS pixels,
Tailwind CSS, shadcn/ui conventions, and RTK Query.
Narrower viewport presentations are outside the supported product contract.

## Commands

Run from the repository root:

```bash
npm run dev -w frontend
npm run generate -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
npm run test:e2e -w frontend
```

Use root `npm run generate:api` after backend controller changes; it refreshes the backend
contract before the frontend client. The Vite development server proxies `/api` to the backend at
`http://127.0.0.1:3000`.

Frontend-authored code uses `@/*` for imports outside the current directory, where `@/` resolves
only to `frontend/src`. Same-directory `./` imports remain valid. TypeScript, Vite, and Bun tests
share this application-local mapping.

## Responsibilities

- Display issue-level usage summaries and detailed session, model, and UTC-daily breakdowns
- Show unlinked, invalid, or changed-candidate sessions and provide explicit relinking
- Display token counts, developer turns, estimated cost, completeness, and sanitized warnings
- Surface session-import, Linear-synchronization, and cost-calculation status and actions

The frontend does not read Codex files, call Linear directly, calculate pricing, or access DuckDB.

## Stack

- React and TypeScript
- Vite and Tailwind CSS
- shadcn/ui and React Router
- RTK Query
- OpenAPI code generation
- Bun test, React Testing Library, and happy-dom
- Playwright for end-to-end coverage

## Routes and state ownership

The stable routes are `/issues`, `/issues/:issueId`, and `/sessions`; `/` redirects to the issue
overview. Issue identity and one-based list pagination belong to React Router. Invalid pagination
normalizes to the first page, and browser back or forward restores the URL-owned page.

RTK Query owns issues, sessions, usage summaries, import state, Linear status, cost status, and
their request lifecycles. The authored API enhancement adds focused cache tags while the generated
client remains untouched. Relink-dialog state stays local to the initiating session record.

## Metric semantics

Counts remain decimal strings through formatting so values above JavaScript's safe integer range
stay exact. `Unavailable` is distinct from zero. Cached input is a labeled subset of input and is
not added to backend totals again. Costs are API-supplied estimates, and daily distinct-session
counts are non-additive across dates. Unknown models and null UTC dates remain explicit buckets.

## API client

The backend-generated OpenAPI document is the API contract. RTK Query endpoints and hooks are
generated from that document. Generated API code must not be edited manually; verification
regenerates it and fails when committed output is stale.

## Source layout

```text
frontend/
├── src/
│   ├── app/             Application shell, providers, and routing
│   ├── components/ui/   Minimal shared presentation primitives
│   ├── features/        Issue, session, and operational features
│   ├── api/             Generated client and authored endpoint enhancement
│   └── lib/             Exact formatters and request helpers
├── __tests__/           Tests mirroring the src tree
├── e2e/                 Deterministic intercepted Playwright flows
├── public/
└── README.md
```

Feature-specific components remain within their feature until they are genuinely reused.

## Testing

- Exact formatters, URL helpers, errors, and cache invalidation: Bun test
- React shell, persistent navigation, and fixed-density expectations: React Testing Library and happy-dom
- Critical cross-route flows: Playwright with deterministic API interception
- Desktop-only browser verification: Playwright Chromium at the 1024 CSS-pixel support boundary

The browser suite covers overview-to-detail navigation, explicit relinking, operational failure
and retry, active polling termination, URL normalization, back navigation, large exact metrics,
and page-level overflow at the minimum supported width.
