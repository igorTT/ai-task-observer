## Why

Free-form, title-derived phase text cannot be grouped reliably because casing, spelling, and
synonyms fragment otherwise equivalent work. Sessions need an explicit canonical phase that can
support consistent filtering and future usage statistics.

## What Changes

- Add a session phase enum with `research`, `explore`, `proposal`, `apply`, `verify`,
  `quick-flow`, and `other`.
- Add an API operation that explicitly assigns or clears a session phase and returns the updated
  session attribution.
- **BREAKING** Stop extracting phase metadata from the session title; the title remains the
  control surface for the Linear issue candidate only.
- Migrate existing stored phase text into the canonical enum, preserving exact canonical values
  and mapping every other non-empty value to `other`.
- Keep phase aggregation and phase-based charts out of this change; the canonical data introduced
  here enables those later capabilities.
- Keep frontend phase-editing controls out of scope; this change establishes the backend contract
  and generated client support only.
- This change has no dependency on the currently planned dashboard or operational-status changes.

## Capabilities

### New Capabilities

- `session-phase-management`: Canonical phase values, explicit phase assignment and clearing, API
  validation, and persistence behavior.

### Modified Capabilities

- `linear-session-attribution`: Remove title-derived phase recognition while retaining exact
  title-based Linear issue candidate parsing and reporting the explicitly assigned phase.

## Impact

- Backend tsoa models and session controller gain a phase mutation contract, requiring OpenAPI and
  frontend RTK Query client regeneration.
- Linear title parsing and attribution reconciliation stop owning phase updates.
- DuckDB attribution persistence receives a migration for canonical legacy phase values.
- Backend API, module, repository, parser, migration, and generated-file verification tests change.

