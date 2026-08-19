CREATE TABLE cost_calculation_generations (
  generation_id VARCHAR PRIMARY KEY,
  source_fact_revision VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  pricing_schema_version INTEGER NOT NULL,
  pricing_catalog_version VARCHAR NOT NULL,
  pricing_content_hash VARCHAR NOT NULL,
  calculator_version VARCHAR NOT NULL,
  token_unit BIGINT NOT NULL CHECK (token_unit > 0),
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  failure_category VARCHAR,
  CHECK (
    (status = 'running' AND completed_at IS NULL AND failure_category IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL AND failure_category IS NULL) OR
    (status = 'failed' AND completed_at IS NOT NULL AND failure_category IS NOT NULL)
  )
);

CREATE INDEX cost_calculation_generations_completed_idx
  ON cost_calculation_generations(status, completed_at);
CREATE INDEX cost_calculation_generations_identity_idx
  ON cost_calculation_generations(
    source_fact_revision, pricing_content_hash, calculator_version, status
  );

CREATE TABLE cost_calculation_items (
  generation_id VARCHAR NOT NULL,
  observation_id VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL,
  source_path VARCHAR NOT NULL,
  source_identity VARCHAR NOT NULL,
  source_record_number BIGINT NOT NULL,
  observed_model VARCHAR NOT NULL,
  observation_time TIMESTAMP,
  canonical_model VARCHAR,
  price_effective_from TIMESTAMP,
  price_effective_to TIMESTAMP,
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

CREATE INDEX cost_calculation_items_observation_idx
  ON cost_calculation_items(observation_id, generation_id);
CREATE INDEX cost_calculation_items_session_idx
  ON cost_calculation_items(session_id, generation_id);
