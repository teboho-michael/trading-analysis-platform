ALTER TABLE candles
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'twelve_direct',
  ADD COLUMN IF NOT EXISTS broker_symbol VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_candles_source
  ON candles (source);

CREATE INDEX IF NOT EXISTS idx_candles_broker_symbol
  ON candles (broker_symbol)
  WHERE broker_symbol IS NOT NULL;
