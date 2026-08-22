CREATE TABLE linear_issues (
  linear_id VARCHAR PRIMARY KEY,
  identifier VARCHAR NOT NULL UNIQUE,
  title VARCHAR NOT NULL,
  url VARCHAR NOT NULL,
  team_id VARCHAR NOT NULL,
  team_key VARCHAR NOT NULL,
  team_name VARCHAR NOT NULL,
  state_id VARCHAR NOT NULL,
  state_name VARCHAR NOT NULL,
  linear_updated_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE INDEX linear_issues_identifier_idx ON linear_issues(identifier);
CREATE INDEX linear_issues_synced_at_idx ON linear_issues(synced_at);

CREATE TABLE linear_session_attributions (
  session_id VARCHAR PRIMARY KEY REFERENCES codex_sessions(session_id),
  title_fingerprint VARCHAR NOT NULL,
  candidate_identifier VARCHAR,
  phase VARCHAR,
  resolution_status VARCHAR NOT NULL CHECK (
    resolution_status IN ('unlinked', 'unconfigured', 'pending', 'linked', 'not_found', 'error')
  ),
  linear_id VARCHAR,
  last_attempt_at TIMESTAMP,
  last_success_at TIMESTAMP,
  failure_category VARCHAR CHECK (
    failure_category IS NULL OR failure_category IN (
      'authentication', 'rate_limit', 'network', 'timeout', 'upstream', 'identifier_mismatch', 'unknown'
    )
  ),
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  CHECK ((resolution_status = 'linked' AND linear_id IS NOT NULL) OR resolution_status <> 'linked'),
  CHECK (candidate_identifier IS NOT NULL OR resolution_status IN ('unlinked', 'linked'))
);

CREATE INDEX linear_session_attributions_candidate_idx
  ON linear_session_attributions(candidate_identifier);
CREATE INDEX linear_session_attributions_status_idx
  ON linear_session_attributions(resolution_status);
CREATE INDEX linear_session_attributions_linear_id_idx
  ON linear_session_attributions(linear_id);

CREATE TABLE linear_sync_runs (
  run_id VARCHAR PRIMARY KEY,
  trigger VARCHAR NOT NULL CHECK (trigger IN ('startup', 'event', 'manual')),
  state VARCHAR NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed')),
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  linked_count INTEGER NOT NULL DEFAULT 0 CHECK (linked_count >= 0),
  not_found_count INTEGER NOT NULL DEFAULT 0 CHECK (not_found_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  failure_category VARCHAR CHECK (
    failure_category IS NULL OR failure_category IN (
      'authentication', 'rate_limit', 'network', 'timeout', 'upstream', 'identifier_mismatch', 'unknown'
    )
  ),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE INDEX linear_sync_runs_state_idx ON linear_sync_runs(state);
CREATE INDEX linear_sync_runs_completed_at_idx ON linear_sync_runs(completed_at);
