DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM candles
    GROUP BY asset_id, timeframe, candle_time
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS unique_candles_asset_timeframe_time
      ON candles (asset_id, timeframe, candle_time);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM zones
    GROUP BY asset_id, timeframe, zone_type, zone_high, zone_low, status
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS unique_zones_asset_timeframe_type_levels_status
      ON zones (asset_id, timeframe, zone_type, zone_high, zone_low, status);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM signals
    WHERE zone_id IS NOT NULL
    GROUP BY asset_id, zone_id, signal_type
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS unique_signals_asset_zone_type
      ON signals (asset_id, zone_id, signal_type)
      WHERE zone_id IS NOT NULL;
  END IF;
END
$$;
