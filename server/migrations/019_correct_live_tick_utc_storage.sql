-- Preserve every legacy row, but do not certify timezone-less historical values
-- as absolute instants. AT TIME ZONE 'UTC' deterministically preserves each stored
-- wall-clock value as a UTC instant; utc_storage_valid remains FALSE for those rows,
-- so they cannot outrank ticks written by the corrected runtime.
ALTER TABLE live_ticks
  ADD COLUMN IF NOT EXISTS utc_storage_valid BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'live_ticks'
      AND column_name = 'tick_time'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE live_ticks
      ALTER COLUMN tick_time TYPE TIMESTAMPTZ
        USING tick_time AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'live_ticks'
      AND column_name = 'received_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE live_ticks
      ALTER COLUMN received_at TYPE TIMESTAMPTZ
        USING received_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

ALTER TABLE live_ticks
  ALTER COLUMN received_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_live_ticks_valid_symbol_received
  ON live_ticks (platform_symbol, received_at DESC)
  WHERE utc_storage_valid = TRUE AND source = 'mt5_broker';
