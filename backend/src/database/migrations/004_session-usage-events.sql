CREATE TABLE codex_session_events (
  event_id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL CHECK (source_record_number >= 0),
  event_kind VARCHAR NOT NULL CHECK (event_kind IN ('user_message', 'assistant_message', 'model_context', 'token_usage')),
  message_role VARCHAR CHECK (message_role IN ('user', 'assistant')),
  event_time TIMESTAMP,
  message_content VARCHAR,
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  UNIQUE (source_path, source_record_number, event_kind)
);

CREATE INDEX codex_session_events_session_idx ON codex_session_events(session_id);
CREATE INDEX codex_session_events_source_idx ON codex_session_events(source_path);

CREATE TABLE codex_usage_observations (
  observation_id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL,
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  model VARCHAR NOT NULL,
  event_time TIMESTAMP,
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
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  UNIQUE (source_path, source_record_number)
);

CREATE INDEX codex_usage_observations_session_idx ON codex_usage_observations(session_id);
CREATE INDEX codex_usage_observations_source_idx ON codex_usage_observations(source_path);

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
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

INSERT INTO codex_usage_observations (
  observation_id, session_id, source_path, source_identity, source_record_number,
  parser_version, model, normalized_input, normalized_cached_input,
  normalized_uncached_input, normalized_output, normalized_total,
  normalization_epoch, normalization_method, complete, anomaly_codes, legacy
)
SELECT
  'legacy:' || s.session_id, s.session_id, s.source_path, 'legacy', -1,
  s.parser_version, 'unknown', u.input_tokens,
  CASE WHEN u.cached_input_tokens <= u.input_tokens THEN u.cached_input_tokens ELSE NULL END,
  CASE WHEN u.cached_input_tokens <= u.input_tokens
    THEN u.input_tokens - u.cached_input_tokens ELSE NULL END,
  u.output_tokens, u.input_tokens + u.output_tokens, 0, 'legacy_aggregate', false,
  '["legacy_aggregate"]', true
FROM codex_session_usage u
JOIN codex_sessions s ON s.session_id = u.session_id
WHERE u.usage_observed;

CREATE TABLE codex_session_usage_next (
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
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  CHECK (input_tokens IS NULL OR input_tokens >= 0),
  CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  CHECK (uncached_input_tokens IS NULL OR uncached_input_tokens >= 0),
  CHECK (output_tokens IS NULL OR output_tokens >= 0),
  CHECK (total_tokens IS NULL OR total_tokens >= 0)
);

INSERT INTO codex_session_usage_next (
  session_id, input_tokens, cached_input_tokens, uncached_input_tokens,
  output_tokens, total_tokens, usage_observed, anomaly_codes
)
SELECT
  session_id,
  CASE WHEN usage_observed THEN input_tokens ELSE NULL END,
  CASE WHEN usage_observed AND cached_input_tokens <= input_tokens THEN cached_input_tokens ELSE NULL END,
  CASE WHEN usage_observed AND cached_input_tokens <= input_tokens
    THEN input_tokens - cached_input_tokens ELSE NULL END,
  CASE WHEN usage_observed THEN output_tokens ELSE NULL END,
  CASE WHEN usage_observed THEN input_tokens + output_tokens ELSE NULL END,
  usage_observed,
  CASE WHEN usage_observed THEN '["legacy_aggregate"]' ELSE '[]' END
FROM codex_session_usage;

DROP TABLE codex_session_usage;
ALTER TABLE codex_session_usage_next RENAME TO codex_session_usage;
