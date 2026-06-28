const pool = require("../db/connection");
const { saveCandle } = require("../market/candleCollector");

const getAllCandles = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                candles.id,
                assets.symbol,
                candles.timeframe,
                candles.open,
                candles.high,
                candles.low,
                candles.close,
                candles.volume,
                candles.candle_time
            FROM candles
            JOIN assets ON candles.asset_id = assets.id
            ORDER BY candles.candle_time DESC
        `);

    res.json({
      success: true,
      candles: result.rows,
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
    const { symbol, timeframe } = req.params;

    const result = await pool.query(
      `
            SELECT
                candles.id,
                assets.symbol,
                candles.timeframe,
                candles.open,
                candles.high,
                candles.low,
                candles.close,
                candles.volume,
                candles.candle_time
            FROM candles
            JOIN assets
                ON candles.asset_id = assets.id
            WHERE assets.symbol = $1
            AND candles.timeframe = $2
            ORDER BY candles.candle_time DESC
            LIMIT 300
            `,
      [symbol, timeframe],
    );

    res.json({
      success: true,
      symbol,
      timeframe,
      candles: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const addCandle = async (req, res) => {
  try {
    const { asset_id, timeframe, open, high, low, close, volume, candle_time } =
      req.body;

    const candle = await saveCandle(asset_id, timeframe, {
      open,
      high,
      low,
      close,
      volume,
      candle_time,
    });

    res.status(201).json({
      success: true,
      candle,
    });
  } catch (error) {
    res.status(500).json({
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
