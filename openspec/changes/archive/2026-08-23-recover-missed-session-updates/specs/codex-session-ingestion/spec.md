## ADDED Requirements

### Requirement: Low-frequency missed-notification recovery

The system SHALL periodically reconcile supported session sources beneath every available root so
that ingestion eventually observes file creation and append activity even when native filesystem
notifications are absent. Recovery reconciliation SHALL be configurable, SHALL default to no more
than one sweep per minute, and SHALL preserve native notifications as the prompt update path.

#### Scenario: Append notification is missed

- **WHEN** complete records are appended after a committed checkpoint and no native change
  notification is delivered
- **THEN** the next recovery sweep SHALL discover the advanced source and schedule its incremental
  import without requiring a restart or explicit rescan

#### Scenario: New-file notification is missed

- **WHEN** a supported session file is created beneath an available root and no native creation
  notification is delivered
- **THEN** the next recovery sweep SHALL discover and schedule that source for import

#### Scenario: Recovery sweep finds unchanged sources

- **WHEN** a recovery sweep inspects sources whose committed source state has not advanced
- **THEN** the system SHALL leave session facts and checkpoints unchanged and SHALL NOT duplicate
  token or developer-turn accounting

#### Scenario: Recovery overlaps other ingestion work

- **WHEN** a recovery sweep discovers a source already queued or being processed by watcher,
  startup, or explicit-rescan work
- **THEN** the system SHALL coalesce or serialize the work and SHALL NOT run overlapping imports for
  that source

#### Scenario: Recovery inspection fails

- **WHEN** a recovery sweep cannot discover a root or inspect a source
- **THEN** unrelated roots and sources SHALL continue processing and diagnostics SHALL expose only a
  sanitized source and failure category

#### Scenario: Recovery interval has not elapsed

- **WHEN** an available source changes after one recovery sweep but before the configured interval
  elapses and no native notification is delivered
- **THEN** the system MAY defer that change until the next scheduled sweep and SHALL NOT perform
  continuous high-frequency polling
