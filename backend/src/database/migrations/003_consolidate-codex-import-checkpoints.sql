-- Merge committed parser continuation into the file checkpoint before removing
-- the duplicate persistence row. The migration runner applies this atomically.

SELECT CASE
  WHEN count(*) > 0 THEN error(
    'checkpoint_merge_missing_continuation:' || CAST(count(*) AS VARCHAR)
  )
  ELSE 1
END
FROM codex_import_checkpoints AS checkpoint
LEFT JOIN codex_source_parse_state AS continuation USING (source_path)
WHERE continuation.source_path IS NULL;

SELECT CASE
  WHEN count(*) > 0 THEN error(
    'checkpoint_merge_orphan_continuation:' || CAST(count(*) AS VARCHAR)
  )
  ELSE 1
END
FROM codex_source_parse_state AS continuation
LEFT JOIN codex_import_checkpoints AS checkpoint USING (source_path)
WHERE checkpoint.source_path IS NULL;

SELECT CASE
  WHEN count(*) > 0 THEN error(
    'checkpoint_merge_identity_mismatch:' || CAST(count(*) AS VARCHAR)
  )
  ELSE 1
END
FROM codex_import_checkpoints AS checkpoint
JOIN codex_source_parse_state AS continuation USING (source_path)
WHERE checkpoint.source_identity <> continuation.source_identity
   OR checkpoint.parser_version <> continuation.parser_version;

SELECT CASE
  WHEN count(*) > 0 THEN error(
    'checkpoint_merge_missing_session:' || CAST(count(*) AS VARCHAR)
  )
  ELSE 1
END
FROM codex_source_parse_state AS continuation
JOIN codex_import_checkpoints AS checkpoint USING (source_path)
LEFT JOIN codex_sessions AS session USING (session_id)
WHERE session.session_id IS NULL;

SELECT CASE
  WHEN count(*) > 0 THEN error(
    'checkpoint_merge_invalid_cursor:' || CAST(count(*) AS VARCHAR)
  )
  ELSE 1
END
FROM codex_source_parse_state
WHERE normalization_epoch < 0 OR next_record_number < 1;

ALTER TABLE codex_import_checkpoints RENAME TO codex_import_checkpoints_legacy;

CREATE TABLE codex_import_checkpoints (
  source_path VARCHAR PRIMARY KEY,
  source_root VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  committed_offset BIGINT NOT NULL DEFAULT 0 CHECK (committed_offset >= 0),
  observed_size BIGINT NOT NULL DEFAULT 0 CHECK (observed_size >= 0),
  parser_version INTEGER NOT NULL CHECK (parser_version > 0),
  session_id VARCHAR NOT NULL,
  active_model VARCHAR NOT NULL DEFAULT 'unknown',
  normalization_epoch INTEGER NOT NULL DEFAULT 0 CHECK (normalization_epoch >= 0),
  baseline_input BIGINT,
  baseline_cached_input BIGINT,
  baseline_output BIGINT,
  next_record_number BIGINT NOT NULL DEFAULT 1 CHECK (next_record_number >= 1),
  status VARCHAR NOT NULL CHECK (status IN ('pending', 'importing', 'ready', 'stale', 'failed')),
  unknown_records INTEGER NOT NULL DEFAULT 0 CHECK (unknown_records >= 0),
  malformed_records INTEGER NOT NULL DEFAULT 0 CHECK (malformed_records >= 0),
  last_error VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp
);

INSERT INTO codex_import_checkpoints (
  source_path, source_root, source_identity, committed_offset, observed_size,
  parser_version, session_id, active_model, normalization_epoch, baseline_input,
  baseline_cached_input, baseline_output, next_record_number, status,
  unknown_records, malformed_records, last_error, created_at, updated_at
)
SELECT
  checkpoint.source_path, checkpoint.source_root, checkpoint.source_identity,
  checkpoint.committed_offset, checkpoint.observed_size, checkpoint.parser_version,
  continuation.session_id, continuation.active_model, continuation.normalization_epoch,
  continuation.baseline_input, continuation.baseline_cached_input,
  continuation.baseline_output, continuation.next_record_number, checkpoint.status,
  checkpoint.unknown_records, checkpoint.malformed_records, checkpoint.last_error,
  checkpoint.created_at, checkpoint.updated_at
FROM codex_import_checkpoints_legacy AS checkpoint
JOIN codex_source_parse_state AS continuation USING (source_path);

DROP TABLE codex_source_parse_state;
DROP TABLE codex_import_checkpoints_legacy;
