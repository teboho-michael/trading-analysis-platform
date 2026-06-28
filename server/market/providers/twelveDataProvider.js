const axios = require("axios");
const { getProviderSymbol } = require("../symbolMap");

const API_URL = "https://api.twelvedata.com/time_series";

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

const normalizeCandle = (item) => {
  return {
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
    volume: Number(item.volume || 0),
    candle_time: new Date(item.datetime),
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
      .map(normalizeCandle)
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

module.exports = {
  getCandles,
};
