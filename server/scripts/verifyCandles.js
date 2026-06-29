const pool = require("../db/connection");

const run = async () => {
  const counts = await pool.query(`SELECT a.symbol, c.timeframe, COUNT(*)::int AS candle_count, MIN(c.candle_time) AS earliest, MAX(c.candle_time) AS latest FROM candles c JOIN assets a ON a.id=c.asset_id GROUP BY a.symbol,c.timeframe ORDER BY a.symbol,c.timeframe`);
  const invalid = await pool.query(`SELECT COUNT(*)::int AS count FROM candles WHERE high < low OR high < open OR high < close OR low > open OR low > close OR open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL`);
  const duplicates = await pool.query(`SELECT COUNT(*)::int AS groups FROM (SELECT 1 FROM candles GROUP BY asset_id,timeframe,candle_time HAVING COUNT(*)>1) d`);
  const ranges = await pool.query(`SELECT a.symbol, COUNT(*)::int AS count FROM candles c JOIN assets a ON a.id=c.asset_id WHERE (a.symbol='XAUUSD' AND (low<1000 OR high>6000)) OR (a.symbol='BTCUSD' AND (low<10000 OR high>250000)) OR (a.symbol='USDJPY' AND (low<50 OR high>300)) OR (a.symbol IN ('US500','US100') AND (low<100 OR high>1000)) GROUP BY a.symbol`);
  const gaps = await pool.query(`WITH ordered AS (SELECT a.symbol,c.timeframe,c.candle_time,LAG(c.candle_time) OVER (PARTITION BY c.asset_id,c.timeframe ORDER BY c.candle_time) previous_time FROM candles c JOIN assets a ON a.id=c.asset_id) SELECT symbol,timeframe,COUNT(*)::int AS possible_missing_intervals FROM ordered WHERE previous_time IS NOT NULL AND candle_time-previous_time > CASE timeframe WHEN 'H1' THEN INTERVAL '3 hours' WHEN 'H4' THEN INTERVAL '12 hours' ELSE INTERVAL '3 days' END GROUP BY symbol,timeframe ORDER BY symbol,timeframe`);
  const report = { counts: counts.rows, invalidOhlc: invalid.rows[0].count, duplicateGroups: duplicates.rows[0].groups, outOfRange: ranges.rows, possibleGaps: gaps.rows };
  console.log(JSON.stringify(report, null, 2));
  if (report.invalidOhlc || report.duplicateGroups || report.outOfRange.length) process.exitCode = 1;
};
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
