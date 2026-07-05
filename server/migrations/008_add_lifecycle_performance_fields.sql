ALTER TABLE setup_journal
  ADD COLUMN IF NOT EXISTS broker_symbol VARCHAR(64),
  ADD COLUMN IF NOT EXISTS broker_server VARCHAR(128),
  ADD COLUMN IF NOT EXISTS account_currency VARCHAR(16),
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(32) NOT NULL DEFAULT 'analysis_only',
  ADD COLUMN IF NOT EXISTS broker_ticket VARCHAR(128),
  ADD COLUMN IF NOT EXISTS actual_entry NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS actual_stop_loss NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS actual_take_profit NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS actual_close_price NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS actual_profit_loss NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS actual_profit_loss_currency VARCHAR(16),
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS lifecycle_last_checked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS lifecycle_last_price NUMERIC(24,10),
  ADD COLUMN IF NOT EXISTS lifecycle_last_candle_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_update_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

UPDATE setup_journal SET requires_review = FALSE WHERE requires_review IS NULL;
UPDATE setup_journal SET lifecycle_update_count = 0 WHERE lifecycle_update_count IS NULL;
UPDATE setup_journal SET execution_mode = 'analysis_only' WHERE execution_mode IS NULL;

ALTER TABLE setup_journal
  ALTER COLUMN requires_review SET DEFAULT FALSE,
  ALTER COLUMN requires_review SET NOT NULL,
  ALTER COLUMN lifecycle_update_count SET DEFAULT 0,
  ALTER COLUMN lifecycle_update_count SET NOT NULL,
  ALTER COLUMN execution_mode SET DEFAULT 'analysis_only',
  ALTER COLUMN execution_mode SET NOT NULL;

UPDATE setup_journal
SET lifecycle_status = CASE
  WHEN outcome IN ('tp1_hit', 'tp2_hit', 'stopped_out', 'invalidated', 'expired', 'manually_closed') THEN 'completed'
  WHEN outcome = 'triggered' THEN 'active'
  WHEN entry_type = 'watch' THEN 'watching'
  WHEN entry_type = 'setup' THEN 'ready'
  ELSE NULL
END
WHERE lifecycle_status IS NULL;

ALTER TABLE setup_journal ALTER COLUMN lifecycle_status SET DEFAULT 'ready';
ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_lifecycle_status_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_lifecycle_status_check CHECK
  (lifecycle_status IS NULL OR lifecycle_status IN ('watching','ready','triggered','active','completed','invalidated','expired','manually_closed','requires_review'));
ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_outcome_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_outcome_check CHECK
  (outcome IN ('pending','watching','triggered','tp1_hit','tp2_hit','stopped_out','invalidated','expired','manually_closed','requires_review','ambiguous','converted_to_setup','reviewed','ignored'));
ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_execution_mode_check;
ALTER TABLE setup_journal ADD CONSTRAINT setup_journal_execution_mode_check CHECK
  (execution_mode IN ('analysis_only','manual_reconciliation'));

CREATE INDEX IF NOT EXISTS idx_setup_journal_lifecycle_status ON setup_journal (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_setup_journal_lifecycle_open ON setup_journal (entry_type,lifecycle_status,created_at DESC)
  WHERE lifecycle_status IN ('watching','ready','triggered','active','requires_review');
