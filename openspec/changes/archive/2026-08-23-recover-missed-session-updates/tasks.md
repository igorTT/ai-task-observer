## 1. Recovery Scheduling

- [x] 1.1 Extend the coordinator's periodic root reconciliation to rediscover available and
  unavailable roots and enqueue every supported source through the existing serialized pending
  work path.
- [x] 1.2 Make recovery reconciliation single-flight and coalesce timer ticks or watcher/rescan work
  that targets the same source.
- [x] 1.3 Preserve native Chokidar events as the prompt path, retain the 60-second
  `CODEX_ROOT_REDISCOVERY_MS` default, and cleanly stop recovery timers and in-flight sweeps during
  shutdown.
- [x] 1.4 Add sanitized failure logging and debug-level sweep summary evidence without adding API
  fields or persisting periodic import runs.

## 2. Configuration and Documentation

- [x] 2.1 Update configuration descriptions and `.env.example` comments so
  `CODEX_ROOT_REDISCOVERY_MS` clearly controls both unavailable-root rediscovery and
  missed-notification recovery for available roots.
- [x] 2.2 Add configuration coverage confirming the minute-scale default and explicit interval
  overrides remain valid.

## 3. Regression Coverage

- [x] 3.1 Add a coordinator test that suppresses watcher delivery, appends complete token records,
  and proves the next recovery sweep incrementally advances usage and its checkpoint exactly once.
- [x] 3.2 Add a coordinator test that suppresses watcher delivery for a newly created nested source
  and proves the next recovery sweep discovers and imports it.
- [x] 3.3 Cover unchanged-source idempotence, overlapping sweep coalescing, per-root failure
  isolation, and shutdown cleanup without relying on platform-native filesystem events.
- [x] 3.4 Run focused backend ingestion/configuration tests, then run formatting, linting,
  type-checking, and the complete backend test suite.
