const pool = require("../db/connection");
const { MT5_SOURCE, TIMEFRAME_SECONDS, getBucketStart } = require("./mt5MarketMetadataService");

const buildFormingCandle = ({ timeframe, tickRows = [], latestConfirmedClose = null, now = new Date() }) => {
  const bucket = getBucketStart(timeframe, now);
  if (!bucket) return null;
  const valid = tickRows
    .map((row) => ({ price: Number(row.display_price), time: new Date(row.tick_time) }))
    .filter((row) => Number.isFinite(row.price) && !Number.isNaN(row.time.getTime()) && row.time >= bucket && row.time <= now)
    .sort((a, b) => a.time - b.time);
  if (!valid.length && !Number.isFinite(Number(latestConfirmedClose))) return null;
  const prices = valid.map((row) => row.price);
  const open = valid[0]?.price ?? Number(latestConfirmedClose);
  const close = valid.at(-1)?.price ?? open;
  return {
    candle_time: bucket.toISOString(),
    bucket_start: bucket.toISOString(),
    bucket_end: new Date(bucket.getTime() + TIMEFRAME_SECONDS[timeframe] * 1000).toISOString(),
    open,
    high: prices.length ? Math.max(open, ...prices) : open,
    low: prices.length ? Math.min(open, ...prices) : open,
    close,
    volume: valid.length,
    status: "forming_current",
    source: MT5_SOURCE,
  };
};

const getFormingCandle = async (symbol, timeframe, now = new Date()) => {
  const bucket = getBucketStart(timeframe, now);
  if (!bucket) return null;
  const confirmed = await pool.query(
    `SELECT c.close FROM candles c JOIN assets a ON a.id=c.asset_id
     WHERE a.symbol=$1 AND c.timeframe=$2 AND c.source=$3 AND c.candle_time < $4
     ORDER BY c.candle_time DESC LIMIT 1`, [symbol, timeframe, MT5_SOURCE, bucket],
  );
  const ticks = await pool.query(
    `SELECT display_price,tick_time FROM live_ticks
     WHERE platform_symbol=$1 AND source=$2 AND received_at >= $3 AND received_at <= $4
     ORDER BY received_at ASC`, [symbol, MT5_SOURCE, bucket, now],
  );
  return buildFormingCandle({ timeframe, tickRows: ticks.rows, latestConfirmedClose: confirmed.rows[0]?.close, now });
};

module.exports = { buildFormingCandle, getFormingCandle };

