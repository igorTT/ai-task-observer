## MODIFIED Requirements

### Requirement: Operational status and actions

The application shell SHALL surface import, Linear synchronization, and cost-calculation state and
SHALL provide the existing manual rescan, synchronization, and recalculation actions. Actions SHALL
reflect unconfigured, active, queued, stale, failed, and unavailable states without inventing a
successful outcome. The shell SHALL provide one explicit status-refresh action and SHALL NOT
periodically request operational status solely to discover asynchronous changes. The import summary
SHALL show checkpoint totals while limiting per-checkpoint details to checkpoints with a non-ready
state, unknown records, malformed records, or a sanitized error.

#### Scenario: All subsystems are current

- **WHEN** import roots are available, Linear is configured and idle, and cost coverage is current
- **THEN** the shell SHALL present a healthy operational summary without requiring the user to inspect raw status payloads

#### Scenario: A subsystem needs attention

- **WHEN** an import root is unavailable, a run has errors, Linear is unconfigured or failed, or cost coverage is stale or missing
- **THEN** the shell SHALL identify the affected subsystem and expose only sanitized details returned by the API

#### Scenario: User refreshes operational status

- **WHEN** the user invokes the status-refresh action
- **THEN** the dashboard SHALL request fresh import, Linear, and cost-calculation status, retain previously displayed data while refreshing, and indicate that refresh work is pending

#### Scenario: Operational status remains idle

- **WHEN** initial or explicitly refreshed status reports no queued or active operational work
- **THEN** the dashboard SHALL NOT issue periodic operational-status requests

#### Scenario: User starts an operation

- **WHEN** a user invokes rescan, synchronization, or cost recalculation
- **THEN** the dashboard SHALL prevent accidental duplicate submission while pending, show the accepted queued or running state, and refresh relevant status and usage data without starting periodic status polling

#### Scenario: Import checkpoints are healthy

- **WHEN** imported checkpoint status contains ready checkpoints with no unknown records, malformed records, or sanitized error
- **THEN** the import summary SHALL include those checkpoints in its total and SHALL NOT list their individual source details

#### Scenario: Import checkpoint needs attention

- **WHEN** a checkpoint has a non-ready state, unknown records, malformed records, or a sanitized error
- **THEN** the import summary SHALL identify that checkpoint and expose its available sanitized diagnostic counts and state

#### Scenario: Operation request fails

- **WHEN** an operational mutation fails
- **THEN** the dashboard SHALL retain the prior displayed data, report the failure, and provide retry where the backend state permits

#### Scenario: Status refresh fails

- **WHEN** one or more operational status requests fail during an explicit refresh
- **THEN** the dashboard SHALL retain available prior status data and identify each affected subsystem through its existing sanitized error presentation
