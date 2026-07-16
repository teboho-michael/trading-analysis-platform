const pool = require("../db/connection");
const { saveCandle } = require("../market/candleCollector");
const {
  MT5_SOURCE,
  validateSymbolAndTimeframe,
  getBrokerSymbol,
  getClosedCandleCutoff,
  getNextExpectedClose,
  classifyCandleFreshness,
} = require("../services/mt5MarketMetadataService");
const { getFormingCandle } = require("../services/formingCandleService");
const { getLatestTicks } = require("../services/liveTickService");

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 500;

const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
};

const toIso = (value) => (value ? new Date(value).toISOString() : null);

const serializeCandle = (row) => ({
  time: toIso(row.candle_time),
  candle_time: toIso(row.candle_time),
  open: Number(row.open),
  high: Number(row.high),
  low: Number(row.low),
  close: Number(row.close),
  volume: Number(row.volume),
  broker_symbol: row.broker_symbol,
  source: row.source,
});

const getAllCandles = async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          a.symbol,
          c.timeframe,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume,
          c.candle_time,
          c.source,
          c.broker_symbol
        FROM candles c
        JOIN assets a ON c.asset_id = a.id
        WHERE c.source = $1
        ORDER BY c.candle_time DESC
        LIMIT 500
      `,
      [MT5_SOURCE],
    );

    res.json({
      success: true,
      data_source: MT5_SOURCE,
      candles: result.rows.map((row) => ({
        symbol: row.symbol,
        timeframe: row.timeframe,
        ...serializeCandle(row),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getCandlesByAssetAndTimeframe = async (req, res) => {
  try {
    const { symbol, timeframe } = validateSymbolAndTimeframe(
      req.params.symbol,
      req.params.timeframe,
    );
    const brokerSymbol = getBrokerSymbol(symbol);
    const limit = parseLimit(req.query.limit);
    const start = req.query.start ? new Date(req.query.start) : null;
    const end = req.query.end ? new Date(req.query.end) : null;

    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE_RANGE",
        error: "start and end must be valid dates when provided.",
      });
    }

    const closedCutoff = getClosedCandleCutoff(timeframe);
    const result = await pool.query(
      `
        WITH ordered AS (
          SELECT DISTINCT ON (c.candle_time)
            c.open,
            c.high,
            c.low,
            c.close,
            c.volume,
            c.candle_time,
            c.source,
            c.broker_symbol
          FROM candles c
          JOIN assets a ON c.asset_id = a.id
          WHERE a.symbol = $1
            AND c.timeframe = $2
            AND c.source = $3
            AND c.broker_symbol = $4
            AND ($5::timestamp IS NULL OR c.candle_time >= $5)
            AND ($6::timestamp IS NULL OR c.candle_time <= $6)
          ORDER BY c.candle_time DESC, c.id DESC
          LIMIT $7
        )
        SELECT *
        FROM ordered
        ORDER BY candle_time ASC
      `,
      [symbol, timeframe, MT5_SOURCE, brokerSymbol, start, end, limit],
    );

    const candles = result.rows.map(serializeCandle);
    const latestStored = candles.at(-1)?.candle_time || null;
    const latestClosed = candles
      .filter((candle) => new Date(candle.candle_time) <= closedCutoff)
      .at(-1)?.candle_time || null;
    const liveQuote = (await getLatestTicks([symbol])).prices[0];
    const authoritativeForming = liveQuote?.status === "live" ? await getFormingCandle(symbol, timeframe) : null;
    const freshness = classifyCandleFreshness({
      timeframe,
      latestClosedCandleTime: latestClosed,
      candleCount: candles.length,
    });

    res.json({
      success: true,
      symbol,
      platform_symbol: symbol,
      broker_symbol: brokerSymbol,
      timeframe,
      data_source: MT5_SOURCE,
      source: MT5_SOURCE,
      source_purity: {
        source: MT5_SOURCE,
        broker_symbol: brokerSymbol,
        non_mt5_rows_in_response: 0,
        mixed_broker_symbols_in_response: 0,
      },
      candle_count: candles.length,
      earliest_candle_time: candles[0]?.candle_time || null,
      latest_candle_time: latestStored,
      latest_stored_candle_time: latestStored,
      latest_closed_candle_time: latestClosed,
      forming_candle_present: Boolean(authoritativeForming),
      forming_candle_time: authoritativeForming?.candle_time || null,
      forming_candle: authoritativeForming,
      next_expected_close_time: authoritativeForming?.bucket_end || getNextExpectedClose(timeframe, latestClosed || latestStored),
      ...freshness,
      candles,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || "CANDLE_QUERY_ERROR",
      error: error.message,
    });
  }
};

const addCandle = async (req, res) => {
  try {
    const {
      asset_id,
      symbol,
      timeframe,
      open,
      high,
      low,
      close,
      volume,
      candle_time,
    } = req.body;

    if (!asset_id || !symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        error: "asset_id, symbol, and timeframe are required",
      });
    }

    const candle = await saveCandle(
      asset_id,
      timeframe,
      {
        open,
        high,
        low,
        close,
        volume,
        candle_time,
      },
      symbol,
    );

    res.status(201).json({
      success: true,
      candle,
    });
  } catch (error) {
    const status = error.message?.includes("DATA_VALIDATION_ERROR") ? 400 : 500;

    res.status(status).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllCandles,
  getCandlesByAssetAndTimeframe,
  addCandle,
};
