ALTER TABLE candles
  ALTER COLUMN source SET DEFAULT 'mt5_broker';

CREATE INDEX IF NOT EXISTS idx_candles_mt5_evidence
  ON candles (asset_id, timeframe, candle_time)
  WHERE source = 'mt5_broker';
