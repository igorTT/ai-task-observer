-- This project is still pre-consumer. Keep one current schema baseline until
-- a deployed database needs forward-compatible migrations.

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE codex_sessions (
  session_id VARCHAR PRIMARY KEY,
  source_root VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  current_title VARCHAR,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  developer_turns BIGINT NOT NULL DEFAULT 0 CHECK (developer_turns >= 0),
  import_state VARCHAR NOT NULL DEFAULT 'pending'
    CHECK (import_state IN ('pending', 'importing', 'ready', 'stale', 'failed')),
  parser_version INTEGER NOT NULL,
  last_error VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE codex_session_usage (
  session_id VARCHAR PRIMARY KEY,
  input_tokens BIGINT,
  cached_input_tokens BIGINT,
  uncached_input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  usage_observed BOOLEAN NOT NULL DEFAULT false,
  input_complete BOOLEAN NOT NULL DEFAULT false,
  cached_input_complete BOOLEAN NOT NULL DEFAULT false,
  uncached_input_complete BOOLEAN NOT NULL DEFAULT false,
  output_complete BOOLEAN NOT NULL DEFAULT false,
  total_complete BOOLEAN NOT NULL DEFAULT false,
  anomaly_codes VARCHAR NOT NULL DEFAULT '[]',
  fact_revision BIGINT NOT NULL DEFAULT 0 CHECK (fact_revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  CHECK (input_tokens IS NULL OR input_tokens >= 0),
  CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  CHECK (uncached_input_tokens IS NULL OR uncached_input_tokens >= 0),
  CHECK (output_tokens IS NULL OR output_tokens >= 0),
  CHECK (total_tokens IS NULL OR total_tokens >= 0)
);

CREATE TABLE codex_import_checkpoints (
  source_path VARCHAR PRIMARY KEY,
  source_root VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  committed_offset BIGINT NOT NULL DEFAULT 0 CHECK (committed_offset >= 0),
  observed_size BIGINT NOT NULL DEFAULT 0 CHECK (observed_size >= 0),
  observed_modified_at_ms BIGINT NOT NULL DEFAULT 0 CHECK (observed_modified_at_ms >= 0),
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  status VARCHAR NOT NULL CHECK (status IN ('pending', 'importing', 'ready', 'stale', 'failed')),
  unknown_records INTEGER NOT NULL DEFAULT 0 CHECK (unknown_records >= 0),
  malformed_records INTEGER NOT NULL DEFAULT 0 CHECK (malformed_records >= 0),
  last_error VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE codex_import_runs (
  run_id VARCHAR PRIMARY KEY,
  trigger VARCHAR NOT NULL CHECK (trigger IN ('startup', 'watch', 'rescan', 'rediscovery')),
  state VARCHAR NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  roots_discovered INTEGER NOT NULL DEFAULT 0 CHECK (roots_discovered >= 0),
  files_discovered INTEGER NOT NULL DEFAULT 0 CHECK (files_discovered >= 0),
  files_imported INTEGER NOT NULL DEFAULT 0 CHECK (files_imported >= 0),
  sessions_imported INTEGER NOT NULL DEFAULT 0 CHECK (sessions_imported >= 0),
  warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  summary VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

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
  linear_updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE linear_session_attributions (
  session_id VARCHAR PRIMARY KEY REFERENCES codex_sessions(session_id),
  title_fingerprint VARCHAR NOT NULL,
  candidate_identifier VARCHAR,
  phase VARCHAR,
  resolution_status VARCHAR NOT NULL CHECK (
    resolution_status IN ('unlinked', 'unconfigured', 'pending', 'linked', 'not_found', 'error')
  ),
  linear_id VARCHAR,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  failure_category VARCHAR CHECK (
    failure_category IS NULL OR failure_category IN (
      'authentication', 'rate_limit', 'network', 'timeout', 'upstream', 'identifier_mismatch', 'unknown'
    )
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  CHECK ((resolution_status = 'linked' AND linear_id IS NOT NULL) OR resolution_status <> 'linked'),
  CHECK (candidate_identifier IS NOT NULL OR resolution_status IN ('unlinked', 'linked'))
);

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
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE codex_session_events (
  event_id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL CHECK (source_record_number >= 0),
  event_kind VARCHAR NOT NULL CHECK (event_kind IN ('user_message', 'assistant_message', 'model_context', 'token_usage')),
  message_role VARCHAR CHECK (message_role IN ('user', 'assistant')),
  event_time TIMESTAMPTZ,
  message_content VARCHAR,
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  UNIQUE (source_path, source_record_number, event_kind)
);

CREATE TABLE codex_usage_observations (
  observation_id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL,
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  model VARCHAR NOT NULL,
  event_time TIMESTAMPTZ,
  raw_cumulative_input BIGINT,
  raw_cumulative_cached_input BIGINT,
  raw_cumulative_output BIGINT,
  raw_last_input BIGINT,
  raw_last_cached_input BIGINT,
  raw_last_output BIGINT,
  normalized_input BIGINT CHECK (normalized_input IS NULL OR normalized_input >= 0),
  normalized_cached_input BIGINT CHECK (normalized_cached_input IS NULL OR normalized_cached_input >= 0),
  normalized_uncached_input BIGINT CHECK (normalized_uncached_input IS NULL OR normalized_uncached_input >= 0),
  normalized_output BIGINT CHECK (normalized_output IS NULL OR normalized_output >= 0),
  normalized_total BIGINT CHECK (normalized_total IS NULL OR normalized_total >= 0),
  normalization_epoch INTEGER NOT NULL CHECK (normalization_epoch >= 0),
  normalization_method VARCHAR NOT NULL CHECK (normalization_method IN ('cumulative_difference', 'reset_last_usage', 'reset_incomplete', 'standalone_delta', 'legacy_aggregate')),
  complete BOOLEAN NOT NULL,
  anomaly_codes VARCHAR NOT NULL DEFAULT '[]',
  legacy BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  UNIQUE (source_path, source_record_number)
);

CREATE TABLE codex_source_parse_state (
  source_path VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  active_model VARCHAR NOT NULL DEFAULT 'unknown',
  normalization_epoch INTEGER NOT NULL DEFAULT 0 CHECK (normalization_epoch >= 0),
  baseline_input BIGINT,
  baseline_cached_input BIGINT,
  baseline_output BIGINT,
  next_record_number BIGINT NOT NULL DEFAULT 1 CHECK (next_record_number >= 1),
  fact_revision BIGINT NOT NULL DEFAULT 0 CHECK (fact_revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

CREATE TABLE cost_calculation_generations (
  generation_id VARCHAR PRIMARY KEY,
  source_fact_revision VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  pricing_schema_version INTEGER NOT NULL,
  pricing_catalog_version VARCHAR NOT NULL,
  pricing_content_hash VARCHAR NOT NULL,
  calculator_version VARCHAR NOT NULL,
  token_unit BIGINT NOT NULL CHECK (token_unit > 0),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  failure_category VARCHAR,
  CHECK (
    (status = 'running' AND completed_at IS NULL AND failure_category IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL AND failure_category IS NULL) OR
    (status = 'failed' AND completed_at IS NOT NULL AND failure_category IS NOT NULL)
  )
);

CREATE TABLE cost_calculation_items (
  generation_id VARCHAR NOT NULL,
  observation_id VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL,
  observed_model VARCHAR NOT NULL,
  observation_time TIMESTAMPTZ,
  canonical_model VARCHAR,
  price_effective_from TIMESTAMPTZ,
  price_effective_to TIMESTAMPTZ,
  uncached_input_rate DECIMAL(38, 24),
  cached_input_rate DECIMAL(38, 24),
  output_rate DECIMAL(38, 24),
  uncached_input_tokens BIGINT,
  cached_input_tokens BIGINT,
  output_tokens BIGINT,
  uncached_input_cost_usd DECIMAL(38, 24),
  cached_input_cost_usd DECIMAL(38, 24),
  output_cost_usd DECIMAL(38, 24),
  estimated_cost_usd DECIMAL(38, 24),
  cost_complete BOOLEAN NOT NULL,
  gap_codes VARCHAR NOT NULL,
  anomaly_codes VARCHAR NOT NULL,
  PRIMARY KEY (generation_id, observation_id),
  FOREIGN KEY (generation_id) REFERENCES cost_calculation_generations(generation_id)
);

CREATE UNIQUE INDEX codex_sessions_source_path_idx ON codex_sessions(source_path);
CREATE INDEX linear_issues_identifier_idx ON linear_issues(identifier);
CREATE INDEX linear_issues_synced_at_idx ON linear_issues(synced_at);
CREATE INDEX linear_session_attributions_candidate_idx
  ON linear_session_attributions(candidate_identifier);
CREATE INDEX linear_session_attributions_status_idx
  ON linear_session_attributions(resolution_status);
CREATE INDEX linear_session_attributions_linear_id_idx
  ON linear_session_attributions(linear_id);
CREATE INDEX linear_sync_runs_state_idx ON linear_sync_runs(state);
CREATE INDEX linear_sync_runs_completed_at_idx ON linear_sync_runs(completed_at);
CREATE INDEX codex_session_events_session_idx ON codex_session_events(session_id);
CREATE INDEX codex_session_events_source_idx ON codex_session_events(source_path);
CREATE INDEX codex_usage_observations_session_idx ON codex_usage_observations(session_id);
CREATE INDEX codex_usage_observations_source_idx ON codex_usage_observations(source_path);
CREATE INDEX cost_calculation_generations_completed_idx
  ON cost_calculation_generations(status, completed_at);
CREATE INDEX cost_calculation_generations_identity_idx
  ON cost_calculation_generations(
    source_fact_revision, pricing_content_hash, calculator_version, status
  );
CREATE INDEX cost_calculation_items_observation_idx
  ON cost_calculation_items(observation_id, generation_id);
CREATE INDEX cost_calculation_items_session_idx
  ON cost_calculation_items(session_id, generation_id);
