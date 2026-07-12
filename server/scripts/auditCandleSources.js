const pool = require("../db/connection");
const { candleCountsBySource, MT5_SOURCE } = require("../services/mt5EvidencePolicy");

const run = async () => {
  const rows = await candleCountsBySource();
  const totals = rows.reduce((acc, row) => {
    acc.total += Number(row.candles);
    if (row.source === MT5_SOURCE) acc.mt5 += Number(row.candles);
    else acc.nonMt5 += Number(row.candles);
    return acc;
  }, { total: 0, mt5: 0, nonMt5: 0 });

  console.log(JSON.stringify({
    policy: "mt5_only",
    mt5_source: MT5_SOURCE,
    totals,
    by_source_symbol_timeframe: rows,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
