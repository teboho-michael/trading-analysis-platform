-- Idempotent repair for production databases that reached the final runtime
-- without the zone boundary additions from 016 or bridge state from 017.
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS proximal_price NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS distal_price NUMERIC(24,10);

UPDATE zones
SET
  proximal_price = COALESCE(proximal_price, CASE WHEN zone_type = 'supply' THEN zone_low ELSE zone_high END),
  distal_price = COALESCE(distal_price, CASE WHEN zone_type = 'supply' THEN zone_high ELSE zone_low END)
WHERE proximal_price IS NULL OR distal_price IS NULL;

CREATE TABLE IF NOT EXISTS bridge_runtime_state (
  bridge_name VARCHAR(64) PRIMARY KEY,
  process_id INTEGER,
  host_name VARCHAR(255),
  started_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL,
  broker_offset_seconds INTEGER NOT NULL DEFAULT 0,
  terminal_connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_tick_import_at TIMESTAMPTZ,
  last_candle_sync_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'starting',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bridge_runtime_state_heartbeat
  ON bridge_runtime_state (heartbeat_at DESC);
