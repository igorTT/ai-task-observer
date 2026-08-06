CREATE TABLE codex_sessions (
  session_id VARCHAR PRIMARY KEY,
  source_root VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  current_title VARCHAR,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  developer_turns BIGINT NOT NULL DEFAULT 0 CHECK (developer_turns >= 0),
  import_state VARCHAR NOT NULL DEFAULT 'pending' CHECK (import_state IN ('pending', 'importing', 'ready', 'stale', 'failed')),
  parser_version INTEGER NOT NULL,
  last_error VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX codex_sessions_source_path_idx ON codex_sessions(source_path);

CREATE TABLE codex_session_usage (
  session_id VARCHAR PRIMARY KEY,
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  usage_observed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  CHECK (total_tokens = input_tokens + cached_input_tokens + output_tokens)
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
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TABLE codex_import_runs (
  run_id VARCHAR PRIMARY KEY,
  trigger VARCHAR NOT NULL CHECK (trigger IN ('startup', 'watch', 'rescan', 'rediscovery')),
  state VARCHAR NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  roots_discovered INTEGER NOT NULL DEFAULT 0 CHECK (roots_discovered >= 0),
  files_discovered INTEGER NOT NULL DEFAULT 0 CHECK (files_discovered >= 0),
  files_imported INTEGER NOT NULL DEFAULT 0 CHECK (files_imported >= 0),
  sessions_imported INTEGER NOT NULL DEFAULT 0 CHECK (sessions_imported >= 0),
  warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  summary VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);
