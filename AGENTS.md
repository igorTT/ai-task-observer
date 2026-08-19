# Repository Guidelines

## Project Structure & Module Organization

This npm workspace has two TypeScript applications. `backend/src/` contains the Express API,
session ingestion, Linear attribution, and DuckDB repositories. `frontend/src/` contains the
React shell, routes, components, RTK Query API layer, and Zustand stores. Each `__tests__/` tree
mirrors its source layout. Specifications and change artifacts live in `openspec/`; root
`scripts/` holds verification tools.

Do not hand-edit generated files in `backend/generated/`, `backend/src/api/generated/`, or
`frontend/src/api/generated/`. Regenerate all three through the root API command.

## Build, Test, and Development Commands

- `npm ci`: install the locked Node 24 workspace dependencies.
- `npm run generate:api`: regenerate tsoa routes/OpenAPI and the frontend RTK Query client.
- `npm run dev`: run backend (`127.0.0.1:3000`) and Vite frontend (`localhost:5173`).
- `npm test`: run both workspaces' Bun test suites.
- `npm run build`: type-check and build both applications.
- `npm run verify`: run all generated-file, alias, format, lint, type, test, build, and smoke
  checks before opening a pull request.

Use `-w backend` or `-w frontend` for focused commands, for example
`npm run test -w backend`.

## Coding Style & Naming Conventions

TypeScript is strict. Prettier enforces semicolons, double quotes, trailing commas, and a
100-character line width; use `npm run format` and `npm run lint`. Use `@/` across directories
and `./` within one directory; `../` imports are rejected. Name files in kebab-case
(`session-query-service.ts`), React components in PascalCase, and functions in camelCase. Keep
controllers thin and database queries inside repositories.

## Testing Guidelines

Bun is the test runner; backend HTTP tests use Supertest, while frontend tests use React Testing
Library and happy-dom. Name tests `*.test.ts` or `*.test.tsx` and place them in the matching
`__tests__` subtree. Add regression coverage for changed behavior and failure paths. There is no
numeric coverage threshold; CI requires all tests, type checks, lint, and builds to pass.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as `add linear attribution`. Keep commits
independently reviewable. Pull requests should explain the change, reference the issue or OpenSpec
change, list verification, and include screenshots for UI changes. Commit regenerated API
artifacts when the contract changes.

## Security & Data Boundaries

Copy `.env.example` to `.env`; never commit credentials or local DuckDB data. The backend is the
only DuckDB writer and Linear access must remain read-only. For the internal POC, selected explicit
user and assistant message content may be persisted only in structured session-event rows. Never
persist or expose reasoning, tool arguments/results, credentials, opaque raw records, malformed
payloads, or message transcripts through APIs or diagnostics.
