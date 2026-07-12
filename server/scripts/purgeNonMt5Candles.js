const pool = require("../db/connection");
const { candleCountsBySource, MT5_SOURCE } = require("../services/mt5EvidencePolicy");

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm-delete-non-mt5");

const run = async () => {
  const before = await candleCountsBySource();
  const targetRows = before.filter((row) => row.source !== MT5_SOURCE);
  const targetCount = targetRows.reduce((sum, row) => sum + Number(row.candles), 0);

  console.log(JSON.stringify({
    mode: confirm ? "confirm-delete" : "dry-run",
    will_delete: confirm,
    protected_source: MT5_SOURCE,
    target_candle_count: targetCount,
    affected_symbol_timeframes: targetRows,
  }, null, 2));

  if (!confirm) {
    console.log("Dry run only. Re-run with --confirm-delete-non-mt5 to delete non-MT5 candles.");
    return;
  }

  const deleted = await pool.query("DELETE FROM candles WHERE source IS DISTINCT FROM $1", [MT5_SOURCE]);
  const after = await candleCountsBySource();
  console.log(JSON.stringify({
    deleted_rows: deleted.rowCount,
    after,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
