# Frontend

The frontend is the local web interface for exploring Codex usage attributed to Linear issues.

The Vite application foundation is initialized with a routable React shell, Tailwind CSS,
shadcn/ui conventions, RTK Query, and a shell-only Zustand display preference.

## Commands

Run from the repository root:

```bash
npm run dev -w frontend
npm run generate -w frontend
npm run typecheck -w frontend
npm run test -w frontend
npm run build -w frontend
```

Use root `npm run generate:api` after backend controller changes; it refreshes the backend
contract before the frontend client. The Vite development server proxies `/api` to the
backend at `http://127.0.0.1:3000`.

Frontend-authored code uses `@/*` for imports outside the current directory, where `@/`
resolves only to `frontend/src`. Same-directory `./` imports remain valid. TypeScript, Vite,
and Bun tests share this application-local mapping.

## Responsibilities

- Display issue-level usage summaries
- Display the Codex sessions linked to each Linear issue
- Show unlinked or invalid sessions
- Break usage down by date and optional workflow phase
- Display token counts, developer turns, and estimated cost
- Surface session-import and Linear-synchronization status
- Provide local display and filtering preferences

The frontend does not read Codex files, call Linear directly, calculate pricing, or access DuckDB.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- RTK Query
- Zustand
- OpenAPI code generation
- Bun test
- React Testing Library and happy-dom
- Playwright for end-to-end coverage

## State ownership

RTK Query owns data received from the backend:

- Issues
- Sessions
- Usage summaries
- Import status
- Linear synchronization status

Zustand owns local interface state:

- Sidebar and dialog state
- Visible table columns
- Local display preferences
- Theme
- Filters that are not represented in the URL

Server data must not be copied into Zustand. Shareable navigation state, such as the selected issue or date range, should be represented in the URL where practical.

## API client

The backend-generated OpenAPI document is the API contract. RTK Query endpoints and hooks will be generated from that document.

Generated API code must not be edited manually. CI should regenerate it and fail when committed generated output is stale.

## Expected source layout

```text
frontend/
├── src/
│   ├── app/             Application shell, providers, and routing
│   ├── components/      Shared UI components
│   ├── features/        Issue, session, usage, and settings features
│   ├── api/             Generated RTK Query client and API setup
│   ├── stores/          Zustand stores
│   └── lib/             Frontend utilities
├── __tests__/
│   ├── app/             Tests mirroring src/app
│   ├── components/      Tests mirroring src/components
│   ├── features/        Tests mirroring src/features
│   ├── api/             Tests mirroring src/api
│   ├── stores/          Tests mirroring src/stores
│   ├── lib/             Tests mirroring src/lib
│   └── setup.ts         Shared DOM and test setup
├── e2e/                 Playwright tests
├── public/
└── README.md
```

The `__tests__/` tree mirrors the `src/` tree so that each test has a predictable location without mixing production and test files. Feature-specific components should remain within their feature until they are genuinely reused.

## Testing

- Pure utilities and local stores: Bun test
- React components: Bun test, React Testing Library, and happy-dom
- Generated API integration behavior: focused integration tests
- Critical user flows: Playwright

Initial end-to-end flows should cover:

1. Viewing the issue usage list
2. Opening an issue and inspecting its sessions
3. Finding an unlinked session
4. Observing import or Linear synchronization failures

## Foundation behavior

The initial route renders without a backend, imported Codex sessions, or Linear credentials.
Redux contains only the generated RTK Query reducer and middleware. Zustand owns the compact
shell preference, while navigation remains in React Router. Tests run through Bun with
happy-dom and React Testing Library.
