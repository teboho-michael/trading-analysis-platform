CREATE TABLE IF NOT EXISTS mt5_bridge_runs (
  id SERIAL PRIMARY KEY,
  platform_symbol VARCHAR(20) NOT NULL,
  broker_symbol VARCHAR(64) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  received_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  earliest_candle_time TIMESTAMP,
  latest_candle_time TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mt5_bridge_runs_symbol_timeframe_completed
  ON mt5_bridge_runs (platform_symbol, timeframe, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_mt5_bridge_runs_success_completed
  ON mt5_bridge_runs (success, completed_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'setup_journal'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'setup_journal'
      AND column_name = 'tradingview_symbol'
  ) THEN
    ALTER TABLE setup_journal ALTER COLUMN tradingview_symbol DROP NOT NULL;
  END IF;
END $$;
