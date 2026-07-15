CREATE TABLE IF NOT EXISTS live_ticks (
  id SERIAL PRIMARY KEY,
  platform_symbol VARCHAR(20) NOT NULL,
  broker_symbol VARCHAR(64) NOT NULL,
  bid NUMERIC(24,10),
  ask NUMERIC(24,10),
  last NUMERIC(24,10),
  display_price NUMERIC(24,10) NOT NULL,
  spread NUMERIC(24,10),
  tick_time TIMESTAMP NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  freshness VARCHAR(32) NOT NULL DEFAULT 'live',
  status VARCHAR(32) NOT NULL DEFAULT 'live',
  source VARCHAR(32) NOT NULL DEFAULT 'mt5_broker',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT live_ticks_positive_display_price CHECK (display_price > 0),
  CONSTRAINT live_ticks_source_check CHECK (source = 'mt5_broker')
);

CREATE INDEX IF NOT EXISTS idx_live_ticks_symbol_received
  ON live_ticks (platform_symbol, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_ticks_symbol_tick_time
  ON live_ticks (platform_symbol, tick_time DESC);

CREATE TABLE IF NOT EXISTS core_ema_states (
  id SERIAL PRIMARY KEY,
  platform_symbol VARCHAR(20) NOT NULL,
  broker_symbol VARCHAR(64) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  latest_closed_price NUMERIC(24,10),
  ema_200 NUMERIC(24,10),
  price_above_ema BOOLEAN,
  price_below_ema BOOLEAN,
  distance_from_ema NUMERIC(24,10),
  trend_state VARCHAR(32) NOT NULL,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  candle_time TIMESTAMP,
  source VARCHAR(32) NOT NULL DEFAULT 'mt5_broker',
  UNIQUE (platform_symbol, timeframe),
  CONSTRAINT core_ema_states_source_check CHECK (source = 'mt5_broker')
);

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS broker_symbol VARCHAR(64),
  ADD COLUMN IF NOT EXISTS origin_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS origin_candle_index INTEGER,
  ADD COLUMN IF NOT EXISTS base_start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS base_end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS departure_strength NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS test_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_from_live_price NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'mt5_broker';

CREATE INDEX IF NOT EXISTS idx_zones_core_active
  ON zones (asset_id, timeframe, status, updated_at DESC);

ALTER TABLE alert_events
  ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_dedupe_open
  ON alert_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND resolved_at IS NULL;
