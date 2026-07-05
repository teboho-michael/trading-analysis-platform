ALTER TABLE setup_journal
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(32) NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE setup_journal
  ALTER COLUMN strategy_name DROP NOT NULL,
  ALTER COLUMN strategy_version DROP NOT NULL,
  ALTER COLUMN timeframe DROP NOT NULL,
  ALTER COLUMN direction DROP NOT NULL,
  ALTER COLUMN entry DROP NOT NULL,
  ALTER COLUMN stop_loss DROP NOT NULL,
  ALTER COLUMN tp1 DROP NOT NULL;

ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_status_check;
ALTER TABLE setup_journal DROP CONSTRAINT IF EXISTS setup_journal_outcome_check;

ALTER TABLE setup_journal
  ADD CONSTRAINT setup_journal_entry_type_check CHECK (entry_type IN ('setup', 'watch', 'observation', 'provider_limited')),
  ADD CONSTRAINT setup_journal_status_check CHECK (status IN ('pending', 'watching', 'triggered', 'tp1_hit', 'tp2_hit', 'stopped_out', 'invalidated', 'expired', 'manually_closed', 'converted_to_setup', 'reviewed', 'ignored')),
  ADD CONSTRAINT setup_journal_outcome_check CHECK (outcome IN ('pending', 'watching', 'triggered', 'tp1_hit', 'tp2_hit', 'stopped_out', 'invalidated', 'expired', 'manually_closed', 'converted_to_setup', 'reviewed', 'ignored')),
  ADD CONSTRAINT setup_journal_shape_check CHECK (
    (entry_type = 'setup' AND direction IN ('BUY', 'SELL') AND entry IS NOT NULL AND stop_loss IS NOT NULL AND (tp1 IS NOT NULL OR tp2 IS NOT NULL) AND strategy_name IS NOT NULL)
    OR entry_type <> 'setup'
  );

CREATE INDEX IF NOT EXISTS idx_setup_journal_entry_type ON setup_journal (entry_type);
CREATE UNIQUE INDEX IF NOT EXISTS unique_setup_journal_dedupe_key ON setup_journal (dedupe_key) WHERE dedupe_key IS NOT NULL;
