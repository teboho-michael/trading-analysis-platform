CREATE TABLE IF NOT EXISTS research_experiments (
  id BIGSERIAL PRIMARY KEY,
  experiment_key VARCHAR(160) NOT NULL UNIQUE,
  experiment_name VARCHAR(200) NOT NULL,
  description TEXT,
  experiment_type VARCHAR(64) NOT NULL,
  base_strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE SET NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  result_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  CONSTRAINT research_experiments_status_check CHECK (status IN ('pending','running','completed','failed','insufficient_data')),
  CONSTRAINT research_experiments_type_check CHECK (experiment_type IN ('parameter_comparison','strategy_comparison','timeframe_comparison','timeframe_readiness','condition_analysis','feature_analysis'))
);

CREATE INDEX IF NOT EXISTS idx_research_experiments_key ON research_experiments (experiment_key);
CREATE INDEX IF NOT EXISTS idx_research_experiments_type ON research_experiments (experiment_type);
CREATE INDEX IF NOT EXISTS idx_research_experiments_strategy ON research_experiments (base_strategy_version_id);

CREATE TABLE IF NOT EXISTS research_experiment_results (
  id BIGSERIAL PRIMARY KEY,
  experiment_id BIGINT NOT NULL REFERENCES research_experiments(id) ON DELETE CASCADE,
  symbol VARCHAR(32) NOT NULL,
  timeframe VARCHAR(16) NOT NULL,
  date_from TIMESTAMP,
  date_to TIMESTAMP,
  metric_name VARCHAR(120) NOT NULL,
  metric_value NUMERIC(24,8),
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_results_symbol ON research_experiment_results (symbol);
CREATE INDEX IF NOT EXISTS idx_research_results_timeframe ON research_experiment_results (timeframe);
CREATE INDEX IF NOT EXISTS idx_research_results_metric ON research_experiment_results (metric_name);
