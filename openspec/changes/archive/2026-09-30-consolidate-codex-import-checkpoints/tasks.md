# Tasks

## 1. Consolidated persistence and migration

- [x] 1.1 Add a forward migration that validates and merges existing checkpoint/parse-state pairs, preserves continuation and checkpoint metadata, removes the old table and mtime column, and leaves existing migration checksums intact; verify fresh and populated database migration tests in `backend/__tests__/database/migrate.test.ts`.
- [x] 1.2 Cover migration rejection for missing/orphan continuation, mismatched identity/version, and missing sessions; verify failed migration preserves original schema and data and reports sanitized diagnostics.
- [x] 1.3 Extend checkpoint domain types, row mapping, and repository persistence with session ID, active model, baselines, epoch, and next record number; verify repository round trips for normal, null-baseline, and stale checkpoint states in the database tests.

## 2. Importer and parser integration

- [x] 2.1 Load append continuation from the merged checkpoint and remove the separate parse-state persistence lookup; verify append-after-restart tests preserve the preceding model, baseline, epoch, and record cursor without replaying committed records.
- [x] 2.2 Persist continuation with the committed offset and facts inside the existing source transaction; verify injected append/rebuild failures leave the previous continuation, offset, facts, and totals intact, including sanitized stale rebuild status and successful retry.
- [x] 2.3 Replace rebuild, relocation, and source-path replacement cleanup of parse state with the consolidated checkpoint lifecycle; verify existing replacement/relocation regressions and subsequent appends produce no duplicate facts or orphan checkpoints.
- [x] 2.4 Remove the unused parser-state revision, separate parse-state model/repository, and obsolete fixtures while retaining the internal parser continuation type and normalization epoch; verify parser/reset tests pass and production searches find no references to the removed table/repository/revision.
- [x] 2.5 Update ingestion documentation and the map's affected persistence descriptions to reflect the implemented merge and retained epoch, without presenting later audit decisions as completed; verify documented ownership and field names match the final code.

## 3. Integration verification

- [x] 3.1 Compare observation snapshots and cost revisions before/after migration and compare migrated appends with uninterrupted imports for model changes, resets, malformed records, unknown categories, and partial trailing records; verify identical observation IDs, normalized values, anomalies, epochs, developer turns, and accounting revisions.
- [x] 3.2 Verify unchanged ingestion status, session responses, and downstream cost/issue/timeline behavior through focused backend integration tests; confirm no authored API or generated contract changes are required.
- [x] 3.3 Run backend lint/type checks and relevant migration, repository, parser, importer, coordinator, and accounting tests, then `npm run verify`; record results and resolve failures before opening a pull request.
