CREATE TABLE IF NOT EXISTS strategy_versions (
  id BIGSERIAL PRIMARY KEY,
  strategy_key VARCHAR(100) NOT NULL,
  strategy_name VARCHAR(160) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeframe_primary VARCHAR(16) NOT NULL,
  timeframe_confirmation VARCHAR(16),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT strategy_versions_key_version_unique UNIQUE (strategy_key, version)
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy_key ON strategy_versions (strategy_key);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_version ON strategy_versions (version);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_is_active ON strategy_versions (is_active);

CREATE TABLE IF NOT EXISTS backtest_runs (
  id BIGSERIAL PRIMARY KEY,
  strategy_version_id BIGINT NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  symbol VARCHAR(32) NOT NULL,
  timeframe VARCHAR(16) NOT NULL,
  date_from TIMESTAMP NOT NULL,
  date_to TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  candles_evaluated INTEGER NOT NULL DEFAULT 0,
  setups_found INTEGER NOT NULL DEFAULT 0,
  completed_setups INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC(7,2),
  average_r NUMERIC(12,4),
  total_r NUMERIC(12,4),
  max_drawdown_r NUMERIC(12,4),
  result_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT backtest_runs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  CONSTRAINT backtest_runs_date_check CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy_version_id ON backtest_runs (strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_symbol ON backtest_runs (symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_created_at ON backtest_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS backtest_results (
  id BIGSERIAL PRIMARY KEY,
  backtest_run_id BIGINT NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
  symbol VARCHAR(32) NOT NULL,
  strategy_version_id BIGINT NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  setup_time TIMESTAMP NOT NULL,
  direction VARCHAR(8) NOT NULL,
  setup_stage VARCHAR(32) NOT NULL,
  quality_score NUMERIC(5,2),
  entry NUMERIC(24,10) NOT NULL,
  stop_loss NUMERIC(24,10) NOT NULL,
  tp1 NUMERIC(24,10),
  tp2 NUMERIC(24,10),
  triggered_at TIMESTAMP,
  closed_at TIMESTAMP,
  outcome VARCHAR(32) NOT NULL,
  final_r NUMERIC(12,4),
  max_favourable_move NUMERIC(24,10),
  max_adverse_move NUMERIC(24,10),
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_reason TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT backtest_results_direction_check CHECK (direction IN ('BUY', 'SELL'))
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_run_id ON backtest_results (backtest_run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_symbol ON backtest_results (symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy_version_id ON backtest_results (strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_setup_time ON backtest_results (setup_time);
CREATE INDEX IF NOT EXISTS idx_backtest_results_outcome ON backtest_results (outcome);

INSERT INTO strategy_versions
  (strategy_key, strategy_name, version, description, rules_json, timeframe_primary, timeframe_confirmation, is_active)
VALUES
  (
    'supply_demand_ema_200',
    'Supply/Demand + EMA 200 Confirmation',
    'v1',
    'Versioned representation of the current D1/H4 bias, H4 supply/demand, H1 EMA 200 confirmation, and registry-backed risk logic.',
    '{"bias_context":["D1","H4"],"zone":{"timeframe":"H4","type":"supply_or_demand","must_be_active":true},"confirmation":{"timeframe":"H1","indicator":"EMA","period":200,"closed_candles":2},"risk":{"stop":"existing_zone_buffer_logic","tp1_r":2,"tp2_r":3},"data_policy":"stored_candles_only","intrabar_policy":"requires_review_when_tp_and_sl_share_a_candle"}'::jsonb,
    'H1',
    'H4',
    TRUE
  )
ON CONFLICT (strategy_key, version) DO NOTHING;
