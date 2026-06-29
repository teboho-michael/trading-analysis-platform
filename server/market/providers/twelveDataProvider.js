const axios = require("axios");
const { getProviderSymbol } = require("../symbolMap");
const { normalizeSymbol } = require("../candleValidator");

const API_URL = "https://api.twelvedata.com/time_series";
const QUOTE_URL = "https://api.twelvedata.com/quote";

const intervalMap = {
  H1: "1h",
  H4: "4h",
  D1: "1day",
};

const getInterval = (timeframe) => {
  const interval = intervalMap[timeframe];

  if (!interval) {
    throw new Error(`UNSUPPORTED_TIMEFRAME: ${timeframe}`);
  }

  return interval;
};

const normalizeCandle = (item, providerSymbol) => {
  return {
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
    volume: Number(item.volume || 0),
    candle_time: new Date(item.datetime),
    source_symbol: providerSymbol,
  };
};

const classifyProviderError = ({
  statusCode,
  providerMessage,
  internalSymbol,
  providerSymbol,
  timeframe,
}) => {
  const message = providerMessage || "";

  if (statusCode === 429 || message.toLowerCase().includes("rate limit")) {
    return `RATE_LIMIT: Twelve Data rate limit reached for ${internalSymbol} ${timeframe} using ${providerSymbol}`;
  }

  if (
    statusCode === 404 &&
    message.toLowerCase().includes("available starting with")
  ) {
    return `PLAN_LIMIT: ${internalSymbol} ${timeframe} using ${providerSymbol} requires a higher Twelve Data plan`;
  }

  if (
    statusCode === 404 ||
    message.toLowerCase().includes("symbol") ||
    message.toLowerCase().includes("not found")
  ) {
    return `INVALID_SYMBOL: Twelve Data does not support ${providerSymbol} for ${internalSymbol} ${timeframe}`;
  }

  if (message.toLowerCase().includes("apikey")) {
    return `API_KEY_ERROR: Twelve Data API key issue`;
  }

  return `PROVIDER_ERROR: Twelve Data failed for ${internalSymbol} ${timeframe} using ${providerSymbol}: ${message}`;
};

const validateResponse = (data, internalSymbol, providerSymbol, timeframe) => {
  if (!data) {
    throw new Error(
      `EMPTY_RESPONSE: No response from Twelve Data for ${internalSymbol} ${timeframe} using ${providerSymbol}`,
    );
  }

  if (data.status === "error") {
    throw new Error(
      classifyProviderError({
        statusCode: data.code,
        providerMessage: data.message,
        internalSymbol,
        providerSymbol,
        timeframe,
      }),
    );
  }

  if (!Array.isArray(data.values)) {
    throw new Error(
      `NO_CANDLES: No candle values returned for ${internalSymbol} ${timeframe} using ${providerSymbol}`,
    );
  }

  if (data.values.length === 0) {
    throw new Error(
      `NO_CANDLES: Empty candle array returned for ${internalSymbol} ${timeframe} using ${providerSymbol}`,
    );
  }

  const responseSymbol = data.meta?.symbol;

  if (
    !responseSymbol ||
    normalizeSymbol(responseSymbol) !== normalizeSymbol(providerSymbol)
  ) {
    throw new Error(
      `DATA_VALIDATION_ERROR: Twelve Data returned ${responseSymbol || "no symbol metadata"} for requested ${internalSymbol} using ${providerSymbol}`,
    );
  }
};

const getCandles = async (internalSymbol, timeframe) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY_ERROR: TWELVE_DATA_API_KEY is missing in .env");
  }

  const providerSymbol = getProviderSymbol(internalSymbol);
  const interval = getInterval(timeframe);

  try {
    const response = await axios.get(API_URL, {
      params: {
        symbol: providerSymbol,
        interval,
        outputsize: 300,
        apikey: apiKey,
      },
    });

    validateResponse(response.data, internalSymbol, providerSymbol, timeframe);

    return response.data.values
      .map((item) => normalizeCandle(item, providerSymbol))
      .sort((a, b) => a.candle_time - b.candle_time);
  } catch (error) {
    if (error.response) {
      const statusCode = error.response.status;
      const responseData = error.response.data || {};

      throw new Error(
        classifyProviderError({
          statusCode,
          providerMessage: responseData.message || JSON.stringify(responseData),
          internalSymbol,
          providerSymbol,
          timeframe,
        }),
      );
    }

    if (error.message) {
      throw new Error(error.message);
    }

    throw new Error(
      `UNKNOWN_PROVIDER_ERROR: ${internalSymbol} ${timeframe} using ${providerSymbol}`,
    );
  }
};

const getLatestPrice = async (internalSymbol) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("API_KEY_ERROR: TWELVE_DATA_API_KEY is missing in .env");
  const providerSymbol = getProviderSymbol(internalSymbol);
  try {
    const response = await axios.get(QUOTE_URL, { params: { symbol: providerSymbol, apikey: apiKey } });
    const data = response.data;
    if (!data || data.status === "error") {
      throw new Error(classifyProviderError({ statusCode: data?.code, providerMessage: data?.message || "Empty quote response", internalSymbol, providerSymbol, timeframe: "live quote" }));
    }
    const price = Number(data.close || data.price);
    if (!Number.isFinite(price)) throw new Error(`DATA_VALIDATION_ERROR: Twelve Data returned no valid live price for ${internalSymbol} using ${providerSymbol}`);
    const sourceTimestamp = Number.isFinite(Number(data.timestamp)) ? new Date(Number(data.timestamp) * 1000) : data.datetime ? new Date(data.datetime) : null;
    return { price, bid: null, ask: null, timestamp: new Date().toISOString(), sourceTimestamp: sourceTimestamp && !Number.isNaN(sourceTimestamp.getTime()) ? sourceTimestamp.toISOString() : null, marketStatus: typeof data.is_market_open === "boolean" ? (data.is_market_open ? "open" : "closed") : "unavailable" };
  } catch (error) {
    if (error.response) throw new Error(classifyProviderError({ statusCode: error.response.status, providerMessage: error.response.data?.message || JSON.stringify(error.response.data), internalSymbol, providerSymbol, timeframe: "live quote" }));
    throw error;
  }
};

module.exports = {
  getCandles,
  getLatestPrice,
};
