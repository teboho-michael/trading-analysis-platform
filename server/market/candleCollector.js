const pool = require("../db/connection");
const { getMarketDataProvider } = require("./providers/providerFactory");
const {
  validateCandle,
  validateProviderCandles,
} = require("./candleValidator");
const { MT5_SOURCE } = require("../services/mt5EvidencePolicy");

const VALID_TIMEFRAMES = new Set(["H1", "H4", "D1"]);

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

const getAssetById = async (assetId) => {
  const result = await pool.query(
    "SELECT * FROM assets WHERE id = $1",
    [assetId],
  );

  return result.rows[0];
};

const validateTimeframe = (timeframe) => {
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new Error(`DATA_VALIDATION_ERROR: Unsupported timeframe ${timeframe}`);
  }
};

const insertCandle = async (db, assetId, timeframe, candle, options = {}) => {
  const source = options.source || MT5_SOURCE;
  const brokerSymbol = options.brokerSymbol || null;
  const saved = await db.query(
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
            candle_time,
            source,
            broker_symbol
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (asset_id, timeframe, candle_time)
        DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            source = EXCLUDED.source,
            broker_symbol = EXCLUDED.broker_symbol
        RETURNING *, (xmax = 0) AS inserted
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
      source,
      brokerSymbol,
    ],
  );

  return saved.rows[0];
};

const saveCandle = async (assetId, timeframe, candle, expectedSymbol) => {
  validateTimeframe(timeframe);

  const asset = await getAssetById(assetId);

  if (!asset) {
    throw new Error(`DATA_VALIDATION_ERROR: Asset not found for id ${assetId}`);
  }

  if (!expectedSymbol || asset.symbol !== expectedSymbol) {
    throw new Error(
      `DATA_VALIDATION_ERROR: Asset id ${assetId} belongs to ${asset.symbol}, not ${expectedSymbol || "an unspecified symbol"}`,
    );
  }

  const validatedCandle = validateCandle(asset.symbol, candle);

  return insertCandle(pool, asset.id, timeframe, validatedCandle);
};

const collectCandlesForAsset = async (symbol, timeframe) => {
  validateTimeframe(timeframe);

  const asset = await getAssetBySymbol(symbol);

  if (!asset) {
    throw new Error(`Asset not found: ${symbol}`);
  }

  const provider = getMarketDataProvider();

  const candles = await provider.getCandles(symbol, timeframe);
  const validatedCandles = validateProviderCandles(symbol, candles);

  const savedCandles = [];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const candle of validatedCandles) {
      const savedCandle = await insertCandle(
        client,
        asset.id,
        timeframe,
        candle,
        { source: MT5_SOURCE, brokerSymbol: candle.source_symbol || null },
      );
      savedCandles.push(savedCandle);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    symbol,
    timeframe,
    data_source: MT5_SOURCE,
    candlesSaved: savedCandles.length,
    candles: savedCandles,
  };
};

module.exports = {
  collectCandlesForAsset,
  insertCandle,
  saveCandle,
  validateTimeframe,
  getAssetBySymbol,
};
