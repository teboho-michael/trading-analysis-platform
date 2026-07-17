-- Final core hardening: keep existing journal history, but add explicit
-- paper-demo lifecycle states and UTC-aware lifecycle timestamps.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'setup_journal'
      AND column_name = 'lifecycle_last_checked_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE setup_journal
      ALTER COLUMN lifecycle_last_checked_at TYPE TIMESTAMPTZ
        USING lifecycle_last_checked_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'setup_journal'
      AND column_name = 'lifecycle_last_candle_time'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE setup_journal
      ALTER COLUMN lifecycle_last_candle_time TYPE TIMESTAMPTZ
        USING lifecycle_last_candle_time AT TIME ZONE 'UTC';
  END IF;
END
$$;

ALTER TABLE setup_journal
  ADD COLUMN IF NOT EXISTS paper_demo_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paper_demo_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paper_demo_last_tick_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paper_demo_last_received_at TIMESTAMPTZ;

ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_status_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_status_check CHECK
  (status IN ('pending','watching','triggered','active','partial_target','won','lost','tp1_hit','tp2_hit','stopped_out','invalidated','expired','cancelled','manually_closed','converted_to_setup','reviewed','ignored'));

ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_outcome_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_outcome_check CHECK
  (outcome IN ('pending','watching','triggered','active','partial_target','won','lost','tp1_hit','tp2_hit','stopped_out','invalidated','expired','cancelled','manually_closed','requires_review','ambiguous','converted_to_setup','reviewed','ignored'));

ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_lifecycle_status_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_lifecycle_status_check CHECK
  (lifecycle_status IS NULL OR lifecycle_status IN ('pending','watching','ready','triggered','active','partial_target','won','lost','completed','invalidated','expired','cancelled','manually_closed','requires_review'));

ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_execution_mode_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_execution_mode_check CHECK
  (execution_mode IN ('analysis_only','manual_reconciliation','paper_demo'));

CREATE INDEX IF NOT EXISTS idx_setup_journal_paper_demo_open
  ON setup_journal (execution_mode, lifecycle_status, symbol, created_at DESC)
  WHERE execution_mode = 'paper_demo'
    AND lifecycle_status IN ('pending','ready','triggered','active','partial_target','requires_review');
