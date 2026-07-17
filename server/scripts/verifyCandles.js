const pool = require("../db/connection");
const { instrumentRegistry } = require("../market/instrumentRegistry");
const { classifyGapRows } = require("../services/candleGapService");

const buildRangeClause = () => Object.values(instrumentRegistry)
  .map((instrument) => {
    const { min, max } = instrument.priceRange;
    return `(a.symbol='${instrument.symbol}' AND (low<${min} OR high>${max}))`;
  })
  .join(" OR ");

const run = async () => {
  const counts = await pool.query(`SELECT a.symbol, c.timeframe, COUNT(*)::int AS candle_count, MIN(c.candle_time) AS earliest, MAX(c.candle_time) AS latest FROM candles c JOIN assets a ON a.id=c.asset_id GROUP BY a.symbol,c.timeframe ORDER BY a.symbol,c.timeframe`);
  const invalid = await pool.query(`SELECT COUNT(*)::int AS count FROM candles WHERE high < low OR high < open OR high < close OR low > open OR low > close OR open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL`);
  const duplicates = await pool.query(`SELECT COUNT(*)::int AS groups FROM (SELECT 1 FROM candles GROUP BY asset_id,timeframe,candle_time HAVING COUNT(*)>1) d`);
  const ranges = await pool.query(`SELECT a.symbol, COUNT(*)::int AS count FROM candles c JOIN assets a ON a.id=c.asset_id WHERE ${buildRangeClause()} GROUP BY a.symbol`);
  const gaps = await pool.query(`WITH ordered AS (SELECT a.symbol,c.timeframe,c.candle_time,LAG(c.candle_time) OVER (PARTITION BY c.asset_id,c.timeframe ORDER BY c.candle_time) previous_time FROM candles c JOIN assets a ON a.id=c.asset_id WHERE c.source='mt5_broker') SELECT symbol,timeframe,previous_time,candle_time,candle_time-previous_time AS gap FROM ordered WHERE previous_time IS NOT NULL AND candle_time-previous_time > CASE timeframe WHEN 'H1' THEN INTERVAL '3 hours' WHEN 'H4' THEN INTERVAL '12 hours' ELSE INTERVAL '3 days' END ORDER BY symbol,timeframe,previous_time`);
  const classifiedGaps = classifyGapRows(gaps.rows);
  const gapSummary = Object.values(classifiedGaps.reduce((acc, gap) => {
    const key = `${gap.symbol}:${gap.timeframe}:${gap.classification}`;
    acc[key] ||= { symbol: gap.symbol, timeframe: gap.timeframe, classification: gap.classification, count: 0 };
    acc[key].count += 1;
    return acc;
  }, {}));
  const report = { counts: counts.rows, validationRanges: Object.fromEntries(Object.values(instrumentRegistry).map((instrument) => [instrument.symbol, { priceScaleMode: instrument.priceScaleMode, sourceMode: instrument.sourceMode, ...instrument.priceRange }])), invalidOhlc: invalid.rows[0].count, duplicateGroups: duplicates.rows[0].groups, outOfRange: ranges.rows, possibleGaps: gapSummary, classifiedGaps };
  console.log(JSON.stringify(report, null, 2));
  if (report.invalidOhlc || report.duplicateGroups || report.outOfRange.length) process.exitCode = 1;
};
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
