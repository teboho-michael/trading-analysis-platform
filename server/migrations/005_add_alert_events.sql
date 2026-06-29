CREATE TABLE IF NOT EXISTS alert_events (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  symbol VARCHAR(32) NOT NULL,
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  related_signal_id INTEGER REFERENCES signals(id),
  related_zone_id INTEGER REFERENCES zones(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_symbol_created_at ON alert_events (symbol, created_at DESC);
