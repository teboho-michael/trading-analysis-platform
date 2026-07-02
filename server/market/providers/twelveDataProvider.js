const axios = require("axios");
const { getProviderSymbol } = require("../symbolMap");
const { normalizeSymbol } = require("../candleValidator");
const {
  ProviderError,
  createPlanLimitError,
  createProviderResponseError,
  createRateLimitError,
  createUnsupportedSymbolError,
  isRateLimitError,
} = require("./providerError");

const API_URL = "https://api.twelvedata.com/time_series";
const QUOTE_URL = "https://api.twelvedata.com/quote";
const RATE_LIMIT_COOLDOWN_MS = 90000;
const rateLimitCooldowns = new Map();

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
    return createRateLimitError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
    });
  }

  if (
    statusCode === 404 &&
    message.toLowerCase().includes("available starting with")
  ) {
    return createPlanLimitError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
    });
  }

  if (
    statusCode === 404 ||
    message.toLowerCase().includes("symbol") ||
    message.toLowerCase().includes("not found")
  ) {
    return createUnsupportedSymbolError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
    });
  }

  if (message.toLowerCase().includes("apikey")) {
    return new Error("API_KEY_ERROR: Twelve Data API key issue");
  }

  return createProviderResponseError({
    symbol: internalSymbol,
    providerSymbol,
    timeframe,
    message: `Twelve Data returned an invalid response: ${message}`,
  });
};

const cooldownKey = (providerSymbol, timeframe) => `${providerSymbol}:${timeframe}`;

const throwIfCoolingDown = (internalSymbol, providerSymbol, timeframe) => {
  const key = cooldownKey(providerSymbol, timeframe);
  const expiresAt = rateLimitCooldowns.get(key);
  if (!expiresAt) return;
  if (expiresAt <= Date.now()) {
    rateLimitCooldowns.delete(key);
    return;
  }
  throw createRateLimitError({ symbol: internalSymbol, providerSymbol, timeframe });
};

const rememberRateLimit = (error) => {
  if (!isRateLimitError(error)) return;
  rateLimitCooldowns.set(
    cooldownKey(error.providerSymbol, error.timeframe),
    Date.now() + RATE_LIMIT_COOLDOWN_MS,
  );
};

const validateResponse = (data, internalSymbol, providerSymbol, timeframe) => {
  if (!data) {
    throw createProviderResponseError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: "Twelve Data returned an empty response.",
    });
  }

  if (data.status === "error") {
    throw classifyProviderError({
        statusCode: data.code,
        providerMessage: data.message,
        internalSymbol,
        providerSymbol,
        timeframe,
      });
  }

  if (!Array.isArray(data.values)) {
    throw createProviderResponseError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: "Twelve Data returned no candle values.",
    });
  }

  if (data.values.length === 0) {
    throw createProviderResponseError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: "Twelve Data returned an empty candle array.",
    });
  }

  const responseSymbol = data.meta?.symbol;

  if (
    !responseSymbol ||
    normalizeSymbol(responseSymbol) !== normalizeSymbol(providerSymbol)
  ) {
    throw createProviderResponseError({
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: `Twelve Data returned ${responseSymbol || "no symbol metadata"} for requested ${providerSymbol}.`,
    });
  }
};

const getCandles = async (internalSymbol, timeframe) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("API_KEY_ERROR: TWELVE_DATA_API_KEY is missing in .env");
  }

  const providerSymbol = getProviderSymbol(internalSymbol);
  const interval = getInterval(timeframe);
  throwIfCoolingDown(internalSymbol, providerSymbol, timeframe);

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

      const providerError = classifyProviderError({
          statusCode,
          providerMessage: responseData.message || JSON.stringify(responseData),
          internalSymbol,
          providerSymbol,
          timeframe,
        });
      rememberRateLimit(providerError);
      throw providerError;
    }

    rememberRateLimit(error);
    if (error instanceof ProviderError || error.message?.startsWith("API_KEY_ERROR")) throw error;
    throw createProviderResponseError({
      code: "UNKNOWN_PROVIDER_ERROR",
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: "Twelve Data request failed unexpectedly.",
    });
  }
};

const getLatestPrice = async (internalSymbol) => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("API_KEY_ERROR: TWELVE_DATA_API_KEY is missing in .env");
  const providerSymbol = getProviderSymbol(internalSymbol);
  const timeframe = "live quote";
  throwIfCoolingDown(internalSymbol, providerSymbol, timeframe);
  try {
    const response = await axios.get(QUOTE_URL, { params: { symbol: providerSymbol, apikey: apiKey } });
    const data = response.data;
    if (!data || data.status === "error") {
      throw classifyProviderError({ statusCode: data?.code, providerMessage: data?.message || "Empty quote response", internalSymbol, providerSymbol, timeframe });
    }
    const price = Number(data.close || data.price);
    if (!Number.isFinite(price)) throw new Error(`DATA_VALIDATION_ERROR: Twelve Data returned no valid live price for ${internalSymbol} using ${providerSymbol}`);
    const sourceTimestamp = Number.isFinite(Number(data.timestamp)) ? new Date(Number(data.timestamp) * 1000) : data.datetime ? new Date(data.datetime) : null;
    return { price, bid: null, ask: null, timestamp: new Date().toISOString(), sourceTimestamp: sourceTimestamp && !Number.isNaN(sourceTimestamp.getTime()) ? sourceTimestamp.toISOString() : null, marketStatus: typeof data.is_market_open === "boolean" ? (data.is_market_open ? "open" : "closed") : "unavailable" };
  } catch (error) {
    if (error.response) {
      const providerError = classifyProviderError({ statusCode: error.response.status, providerMessage: error.response.data?.message || JSON.stringify(error.response.data), internalSymbol, providerSymbol, timeframe });
      rememberRateLimit(providerError);
      throw providerError;
    }
    rememberRateLimit(error);
    if (error instanceof ProviderError || error.message?.startsWith("API_KEY_ERROR")) throw error;
    throw createProviderResponseError({
      code: "UNKNOWN_PROVIDER_ERROR",
      symbol: internalSymbol,
      providerSymbol,
      timeframe,
      message: "Twelve Data request failed unexpectedly.",
    });
  }
};

module.exports = {
  getCandles,
  getLatestPrice,
  RATE_LIMIT_COOLDOWN_MS,
};
