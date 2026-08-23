## 1. Parser Coverage and Normalization

- [x] 1.1 Add synthetic parser fixtures for current `item_completed`/`UserMessage` records,
  legacy user-message records, mirrored user response items, non-user completed items, and
  malformed completed-user payloads without including real session content.
- [x] 1.2 Extend the Codex record parser to normalize valid current-format user items to the
  existing `user_message` event kind while retaining legacy handling and permitted-content
  filtering.
- [x] 1.3 Add parser assertions proving both explicit formats produce one turn per source record
  and excluded, mirrored, or malformed records produce no turn or persisted opaque content.

## 2. Rebuild and Derived Facts

- [x] 2.1 Advance the Codex parser version from 3 to 4 so existing compatible checkpoints are
  invalidated through the established rebuild path.
- [x] 2.2 Add importer regression coverage showing a version-3 source with a previously omitted
  current-format user message rebuilds to the correct selected event and developer-turn total.
- [x] 2.3 Verify repeat imports, append processing, and legacy sources remain idempotent and do not
  duplicate developer turns after the parser upgrade.

## 3. Verification

- [x] 3.1 Run the focused backend parser and importer test suites and resolve any regressions.
- [x] 3.2 Run backend formatting, linting, type checking, tests, and build verification; confirm no
  API generation or database migration changes are produced.
