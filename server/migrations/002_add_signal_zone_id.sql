ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS zone_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signals_zone_id_fkey'
      AND conrelid = 'signals'::regclass
  ) THEN
    ALTER TABLE signals
      ADD CONSTRAINT signals_zone_id_fkey
      FOREIGN KEY (zone_id) REFERENCES zones(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_signals_asset_zone_type
  ON signals (asset_id, zone_id, signal_type);
