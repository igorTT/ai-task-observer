## MODIFIED Requirements

### Requirement: Deterministic title convention

The system SHALL use the developer-controlled Codex chat title as the Linear issue attribution
control surface. It SHALL treat a session title as attributable only when its trimmed value starts
with a Linear-style identifier composed of a letter-led alphanumeric team key, a hyphen, and a
positive decimal issue number, followed by either the end of the title or a colon and optional
descriptive suffix text. The system SHALL normalize the candidate identifier to uppercase, SHALL
NOT derive a session phase from the title or its suffix, and SHALL NOT use semantic inference.

#### Scenario: New chat retains its default title
- **WHEN** a newly imported Codex chat still has a default title that does not match the attribution convention
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT infer a Linear issue or query Linear for that title

#### Scenario: Developer renames a default-title chat
- **WHEN** the developer renames an imported unlinked chat from its default title to `ENG-215: explore` and ingestion observes the updated title
- **THEN** the system SHALL produce candidate identifier `ENG-215`, SHALL leave its explicitly assigned phase unchanged, and SHALL schedule or perform exact Linear resolution without recreating the session

#### Scenario: Identifier-only title
- **WHEN** an imported session title is `ENG-215`
- **THEN** the system SHALL produce candidate identifier `ENG-215` and SHALL leave its explicitly assigned phase unchanged

#### Scenario: Identifier and phase title
- **WHEN** an imported session title is `eng-215:  apply `
- **THEN** the system SHALL produce candidate identifier `ENG-215` and SHALL NOT interpret `apply` as a phase

#### Scenario: Empty phase suffix
- **WHEN** an imported session title is `ENG-215:`
- **THEN** the system SHALL produce candidate identifier `ENG-215` and SHALL leave its explicitly assigned phase unchanged

#### Scenario: Identifier is not leading
- **WHEN** an imported session title contains `ENG-215` anywhere other than the beginning after trimming
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT query Linear for that title

#### Scenario: Unexpected text follows identifier
- **WHEN** an imported session title is `ENG-215 apply` without the required colon separator
- **THEN** the system SHALL classify the session as unlinked and SHALL NOT guess an identifier

### Requirement: Single current attribution per session

The system SHALL persist exactly one current attribution state for each imported session,
independently of the ingestion-owned session record and usage facts. A successfully established
issue link SHALL remain authoritative until the user explicitly relinks it. Ingestion SHALL parse
later title changes as current title candidates but SHALL NOT replace or clear an existing issue
link or explicitly assigned phase from a title change alone.

#### Scenario: Newly imported session has a valid candidate
- **WHEN** ingestion commits a session with no established issue link whose title matches the attribution convention
- **THEN** the system SHALL persist the candidate, preserve any explicitly assigned phase, and SHALL schedule or perform resolution without changing the session's usage facts

#### Scenario: Newly imported session has no candidate
- **WHEN** ingestion commits a new session whose title does not match the attribution convention
- **THEN** the system SHALL persist an `unlinked` attribution state for that session while preserving any explicitly assigned phase

#### Scenario: Title changes to another identifier
- **WHEN** a session linked to `ENG-215` is renamed to a title with candidate identifier `ENG-216`
- **THEN** the system SHALL preserve the `ENG-215` link, record or expose `ENG-216` as the current title candidate, preserve its explicitly assigned phase, and SHALL NOT resolve or link `ENG-216` until the user explicitly requests relinking

#### Scenario: Title changes to an unlinked title
- **WHEN** an existing linked session title no longer matches the attribution convention
- **THEN** the system SHALL preserve its current issue link and explicitly assigned phase, expose that the current title has no candidate, and preserve all ingestion-owned session and usage data

#### Scenario: Only phase changes
- **WHEN** a session title retains the same candidate identifier but changes its suffix text
- **THEN** the system SHALL preserve the explicitly assigned phase without changing the established issue link or creating a second attribution
