## MODIFIED Requirements

### Requirement: Accessible and responsive presentation

The dashboard SHALL remain usable with keyboard navigation and common assistive technology at
supported desktop viewport widths. The supported presentation range SHALL begin at 1024 CSS pixels,
and the dashboard SHALL keep required navigation, metrics, tables, dialogs, actions, and status
information available without page-level horizontal overflow throughout that range. Presentation
at narrower viewport widths is outside the supported product contract.

#### Scenario: User navigates by keyboard

- **WHEN** a user traverses navigation, pagination, external links, actions, and confirmation controls with a keyboard at a supported desktop viewport width
- **THEN** focus order and visible focus state SHALL follow the logical reading and interaction order

#### Scenario: Status changes asynchronously

- **WHEN** an operation enters a queued, running, succeeded, or failed state at a supported desktop viewport width
- **THEN** the dashboard SHALL expose the meaningful status change through accessible text and an appropriate live region where necessary

#### Scenario: Dashboard is viewed at the minimum supported width

- **WHEN** the dashboard is displayed in a viewport 1024 CSS pixels wide
- **THEN** required identities, metrics, warnings, navigation, dialogs, and actions SHALL remain available in the desktop presentation without page-level horizontal overflow

#### Scenario: Dashboard is viewed on a narrow screen

- **WHEN** the dashboard is displayed in a viewport narrower than 1024 CSS pixels
- **THEN** the dashboard SHALL retain its desktop presentation and SHALL NOT provide alternative narrow-screen navigation or table layouts

### Requirement: Frontend data and privacy boundaries

The dashboard SHALL obtain server data only through the generated API boundary and SHALL not read
Codex session files, DuckDB, or Linear directly. It SHALL not render or request message
transcripts, reasoning, tool arguments or results, credentials, or raw source records. The
dashboard SHALL use one fixed presentation density based on the former comfortable spacing and
SHALL not offer or retain a compact/comfortable density preference in client state.

#### Scenario: Dashboard renders session information

- **WHEN** a session list or issue detail is displayed
- **THEN** the dashboard SHALL use normalized metadata, accounting, attribution, and sanitized diagnostic fields from the API without exposing stored message content

#### Scenario: Local display preference changes

- **WHEN** a user views the dashboard or navigates between its routes
- **THEN** the dashboard SHALL retain one fixed presentation density and SHALL not expose a compact/comfortable density control
