const pool = require("../db/connection");
const { getMarketDataProvider } = require("./providers/providerFactory");

const getAssetBySymbol = async (symbol) => {
  const result = await pool.query(
    `
        SELECT *
        FROM assets
        WHERE symbol = $1
        `,
    [symbol],
  );

  return result.rows[0];
};

const saveCandle = async (assetId, timeframe, candle) => {
  const saved = await pool.query(
    `
        INSERT INTO candles
        (
            asset_id,
            timeframe,
            open,
            high,
            low,
            close,
            volume,
            candle_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (asset_id, timeframe, candle_time)
        DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume
        RETURNING *
        `,
    [
      assetId,
      timeframe,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume || 0,
      candle.candle_time,
    ],
  );

  return saved.rows[0];
};

const collectCandlesForAsset = async (symbol, timeframe) => {
  const asset = await getAssetBySymbol(symbol);

  if (!asset) {
    throw new Error(`Asset not found: ${symbol}`);
  }

  const provider = getMarketDataProvider();

  const candles = await provider.getCandles(symbol, timeframe);

  const savedCandles = [];

  for (const candle of candles) {
    const savedCandle = await saveCandle(asset.id, timeframe, candle);
    savedCandles.push(savedCandle);
  }

  return {
    symbol,
    timeframe,
    candlesSaved: savedCandles.length,
    candles: savedCandles,
  };
};

module.exports = {
  collectCandlesForAsset,
  saveCandle,
};
