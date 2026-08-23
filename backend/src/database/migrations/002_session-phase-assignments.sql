CREATE TABLE session_phase_assignments (
  session_id VARCHAR PRIMARY KEY,
  phase VARCHAR NOT NULL CHECK (
    phase IN ('research', 'explore', 'proposal', 'apply', 'verify', 'quick-flow', 'other')
  )
);

INSERT INTO session_phase_assignments (session_id, phase)
SELECT
  session_id,
  CASE
    WHEN phase IN ('research', 'explore', 'proposal', 'apply', 'verify', 'quick-flow', 'other')
      THEN phase
    ELSE 'other'
  END
FROM linear_session_attributions
WHERE phase IS NOT NULL AND length(trim(phase)) > 0;

DROP INDEX linear_session_attributions_candidate_idx;
DROP INDEX linear_session_attributions_status_idx;
DROP INDEX linear_session_attributions_linear_id_idx;
ALTER TABLE linear_session_attributions RENAME TO linear_session_attributions_legacy;

CREATE TABLE linear_session_attributions (
  session_id VARCHAR PRIMARY KEY REFERENCES codex_sessions(session_id),
  title_fingerprint VARCHAR NOT NULL,
  candidate_identifier VARCHAR,
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

INSERT INTO linear_session_attributions (
  session_id, title_fingerprint, candidate_identifier, resolution_status,
  linear_id, last_attempt_at, last_success_at, failure_category, updated_at
)
SELECT
  session_id, title_fingerprint, candidate_identifier, resolution_status,
  linear_id, last_attempt_at, last_success_at, failure_category, updated_at
FROM linear_session_attributions_legacy;

DROP TABLE linear_session_attributions_legacy;
CREATE INDEX linear_session_attributions_candidate_idx
  ON linear_session_attributions(candidate_identifier);
CREATE INDEX linear_session_attributions_status_idx
  ON linear_session_attributions(resolution_status);
CREATE INDEX linear_session_attributions_linear_id_idx
  ON linear_session_attributions(linear_id);
