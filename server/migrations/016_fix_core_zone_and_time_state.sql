ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS proximal_price NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS distal_price NUMERIC(24,10);

UPDATE zones
SET
  proximal_price = CASE
    WHEN proximal_price IS NOT NULL THEN proximal_price
    WHEN zone_type = 'demand' THEN zone_high
    WHEN zone_type = 'supply' THEN zone_low
    ELSE zone_high
  END,
  distal_price = CASE
    WHEN distal_price IS NOT NULL THEN distal_price
    WHEN zone_type = 'demand' THEN zone_low
    WHEN zone_type = 'supply' THEN zone_high
    ELSE zone_low
  END
WHERE proximal_price IS NULL OR distal_price IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_h4_origin_mt5_unique
  ON zones (asset_id, timeframe, zone_type, origin_time, source)
  WHERE origin_time IS NOT NULL AND source = 'mt5_broker';
