const axios = require("axios");
const { getInstrument } = require("../instrumentRegistry");

const client = axios.create({ baseURL: process.env.MT5_BRIDGE_URL || "http://127.0.0.1:7001", timeout: Number(process.env.MT5_BRIDGE_TIMEOUT_MS || 10000) });

const request = async (path, params) => {
  try { return (await client.get(path, { params })).data; }
  catch (error) {
    const detail = error.response?.data?.error || error.response?.data?.message || error.message;
    throw new Error(`MT5_BRIDGE_ERROR: ${detail}`);
  }
};

const getCandles = async (symbol, timeframe, limit = 300) => {
  const instrument = getInstrument(symbol);
  const data = await request("/candles", { symbol: instrument.brokerSymbol, timeframe, limit });
  if (!Array.isArray(data.candles)) throw new Error("MT5_BRIDGE_ERROR: Bridge returned no candle array");
  return data.candles.map((candle) => ({ ...candle, candle_time: new Date(candle.candle_time), source_symbol: instrument.brokerSymbol }));
};

const getLatestPrice = async (symbol) => request("/latest-price", { symbol: getInstrument(symbol).brokerSymbol });
const getInstrumentSpec = async (symbol) => request("/symbols", { symbol: getInstrument(symbol).brokerSymbol });
const getHealth = async () => request("/health");

module.exports = { getCandles, getLatestPrice, getInstrumentSpec, getHealth };
