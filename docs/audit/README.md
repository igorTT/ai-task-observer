# Application Audit

## Goal

Understand how the current application works before planning further features or optimizations.
The audit replaces the immediate focus on `add-portable-usage-rollups`; active OpenSpec changes
remain untouched until their assumptions are reviewed.

## Format

Each document records only:

- current behavior;
- relevant evidence;
- accepted decisions;
- open questions.

Audit findings are not implementation plans. Accepted groups of changes will later receive small,
independent OpenSpec proposals.

## Current Decisions

- Audit documents are written in English.
- Automatic Linear attribution is outside the MVP ingestion flow for now.
- Manual linking must become stable before automatic attribution is reconsidered.
- A Codex session is resumable and has no reliable terminal state.

## Inventory

| Area                         | Status                     | Document                                                               |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Architecture                 | Current map available      | [Cartodex map](../CARTODEX_MAP.md)                                     |
| Session ingestion flow       | Documented                 | [ingestion-flow.md](ingestion-flow.md)                                 |
| `CodexSession`               | Reviewed, questions remain | [codex-session.md](data-models/codex-session.md)                       |
| `CodexImportCheckpoint`      | Ready for review           | [codex-import-checkpoint.md](data-models/codex-import-checkpoint.md)   |
| `CodexSourceParseState`      | Ready for review           | [codex-source-parse-state.md](data-models/codex-source-parse-state.md) |
| `CodexSessionEvent`          | Ready for review           | [codex-session-event.md](data-models/codex-session-event.md)           |
| `CodexUsageObservation`      | Ready for review           | [codex-usage-observation.md](data-models/codex-usage-observation.md)   |
| `CodexSessionUsage`          | Ready for review           | [codex-session-usage.md](data-models/codex-session-usage.md)           |
| `CodexImportRun`             | Ready for review           | [codex-import-run.md](data-models/codex-import-run.md)                 |
| Cost models                  | Not started                | —                                                                      |
| Attribution and phase models | Not started                | —                                                                      |
| API and frontend             | Not started                | —                                                                      |
| Active OpenSpec changes      | Not started                | —                                                                      |

## Suggested Order

1. Ingestion and source models
2. Events and usage observations
3. Derived session summaries
4. Cost models
5. Attribution and phase models
6. API and frontend behavior
7. Active OpenSpec changes

## Next Review

Review `CodexImportCheckpoint` next, followed by `CodexSourceParseState`. Together they are the
likely destination for source ownership and import readiness removed from `CodexSession`.
