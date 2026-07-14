const pool = require("../db/connection");
const {
  getAssetBySymbol,
  insertCandle,
  validateTimeframe,
} = require("../market/candleCollector");
const { validateCandle } = require("../market/candleValidator");
const { MT5_SYMBOL_MAP } = require("./mt5SymbolMapService");
const { getBrokerSymbol } = require("./mt5MarketMetadataService");

const SOURCE = "mt5_broker";

const validationError = (message, details = null) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
};

const normalizeSymbol = (value) => String(value || "").trim().toUpperCase();

const normalizeCandleTime = (candle) =>
  candle.candle_time || candle.time || candle.date_time || candle.datetime;

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("Malformed import payload");
  }

  const symbol = normalizeSymbol(payload.symbol);
  const timeframe = normalizeSymbol(payload.timeframe);
  const brokerSymbol = String(payload.broker_symbol || "").trim();

  if (!symbol || !timeframe || !brokerSymbol || !Array.isArray(payload.candles)) {
    throw validationError("symbol, broker_symbol, timeframe, and candles are required");
  }

  validateTimeframe(timeframe);

  if (!MT5_SYMBOL_MAP[symbol]) {
    throw validationError(`Unsupported MT5 bridge symbol: ${symbol}`);
  }

  if (brokerSymbol !== getBrokerSymbol(symbol)) {
    throw validationError(`Broker symbol mismatch for ${symbol}: expected ${getBrokerSymbol(symbol)}, received ${brokerSymbol}`);
  }

  if (payload.candles.length === 0) {
    throw validationError("candles must contain at least one candle");
  }

  return { symbol, brokerSymbol, timeframe, candles: payload.candles };
};

const mapCandle = (symbol, candle, index) => {
  const normalized = {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume ?? candle.tick_volume ?? candle.real_volume ?? 0,
    candle_time: normalizeCandleTime(candle),
    tick_volume: candle.tick_volume,
    spread: candle.spread,
    real_volume: candle.real_volume,
  };

  return validateCandle(symbol, normalized, index);
};

const importCandles = async (payload) => {
  const { symbol, brokerSymbol, timeframe, candles } = validatePayload(payload);
  const asset = await getAssetBySymbol(symbol);
  const startedAt = payload.started_at ? new Date(payload.started_at) : null;

  if (!asset) {
    throw validationError(`Asset not found for symbol: ${symbol}`);
  }

  const client = await pool.connect();
  const rejected = [];
  const saved = [];

  try {
    await client.query("BEGIN");

    for (let index = 0; index < candles.length; index += 1) {
      try {
        const candle = mapCandle(symbol, candles[index], index);
        const row = await insertCandle(client, asset.id, timeframe, candle, {
          source: SOURCE,
          brokerSymbol,
        });
        saved.push(row);
      } catch (error) {
        rejected.push({ index, reason: error.message });
      }
    }

    const sortedTimes = saved
      .map((row) => new Date(row.candle_time))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a - b);

    await client.query(
      `
        INSERT INTO mt5_bridge_runs
        (
          platform_symbol,
          broker_symbol,
          timeframe,
          started_at,
          completed_at,
          success,
          received_count,
          inserted_count,
          updated_count,
          rejected_count,
          earliest_candle_time,
          latest_candle_time
        )
        VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,TRUE,$5,$6,$7,$8,$9,$10)
      `,
      [
        symbol,
        brokerSymbol,
        timeframe,
        startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : null,
        candles.length,
        saved.filter((row) => row.inserted).length,
        saved.filter((row) => !row.inserted).length,
        rejected.length,
        sortedTimes[0] || null,
        sortedTimes.at(-1) || null,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const sortedTimes = saved
    .map((row) => new Date(row.candle_time))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  return {
    symbol,
    broker_symbol: brokerSymbol,
    timeframe,
    received_count: candles.length,
    inserted_count: saved.filter((row) => row.inserted).length,
    updated_count: saved.filter((row) => !row.inserted).length,
    rejected_count: rejected.length,
    earliest: sortedTimes[0]?.toISOString() || null,
    latest: sortedTimes.at(-1)?.toISOString() || null,
    source: SOURCE,
    rejected,
  };
};

module.exports = {
  importCandles,
};
