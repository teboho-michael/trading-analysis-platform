const { getInstrument, instrumentRegistry } = require("../market/instrumentRegistry");

const MT5_SOURCE = "mt5_broker";
const SUPPORTED_TIMEFRAMES = Object.freeze(["D1", "H4", "H1"]);
const TIMEFRAME_SECONDS = Object.freeze({
  H1: 60 * 60,
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
});
const FRESHNESS_DELAY_SECONDS = Object.freeze({
  H1: 20 * 60,
  H4: 35 * 60,
  D1: 4 * 60 * 60,
});

const normalizeSymbol = (value) => String(value || "").trim().toUpperCase();
const normalizeTimeframe = (value) => String(value || "").trim().toUpperCase();

const isSupportedSymbol = (symbol) => Boolean(instrumentRegistry[normalizeSymbol(symbol)]);
const isSupportedTimeframe = (timeframe) => SUPPORTED_TIMEFRAMES.includes(normalizeTimeframe(timeframe));

const validateSymbolAndTimeframe = (symbol, timeframe) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedTimeframe = normalizeTimeframe(timeframe);

  if (!isSupportedSymbol(normalizedSymbol)) {
    const error = new Error(`Unsupported platform symbol: ${symbol}`);
    error.statusCode = 400;
    error.code = "UNSUPPORTED_SYMBOL";
    throw error;
  }

  if (!isSupportedTimeframe(normalizedTimeframe)) {
    const error = new Error(`Unsupported timeframe: ${timeframe}`);
    error.statusCode = 400;
    error.code = "UNSUPPORTED_TIMEFRAME";
    throw error;
  }

  return { symbol: normalizedSymbol, timeframe: normalizedTimeframe };
};

const getBrokerSymbol = (symbol) => getInstrument(symbol).brokerSymbol;

const getNextExpectedClose = (timeframe, candleTime) => {
  const duration = TIMEFRAME_SECONDS[timeframe];
  const timestamp = candleTime ? new Date(candleTime).getTime() : NaN;
  if (!duration || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp + duration * 1000).toISOString();
};

const getClosedCandleCutoff = (timeframe, now = new Date()) => {
  const duration = TIMEFRAME_SECONDS[timeframe];
  if (!duration) return now;
  // Stored MT5 candle_time values are UTC candle-open times from the bridge.
  return new Date(now.getTime() - duration * 1000);
};

const classifyCandleFreshness = ({
  timeframe,
  latestClosedCandleTime,
  candleCount,
  now = new Date(),
}) => {
  if (!candleCount) {
    return {
      freshness: "awaiting_first_sync",
      stale_threshold_seconds: null,
      candle_age_seconds: null,
      reason: "No MT5 broker candles are stored for this symbol and timeframe.",
    };
  }

  const latestTime = latestClosedCandleTime ? new Date(latestClosedCandleTime).getTime() : NaN;
  if (!Number.isFinite(latestTime)) {
    return {
      freshness: "missing",
      stale_threshold_seconds: null,
      candle_age_seconds: null,
      reason: "Latest closed candle time is unavailable.",
    };
  }

  const threshold = TIMEFRAME_SECONDS[timeframe] + FRESHNESS_DELAY_SECONDS[timeframe];
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - latestTime) / 1000));

  if (ageSeconds <= threshold) {
    return {
      freshness: "current",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: "Latest closed MT5 candle is within the timeframe-aware freshness window.",
    };
  }

  if (timeframe === "D1" && ageSeconds <= threshold + 3 * TIMEFRAME_SECONDS.D1) {
    return {
      freshness: "market_closed",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: "Daily candles can remain unchanged during broker market closures.",
    };
  }

  return {
    freshness: ageSeconds <= threshold * 2 ? "delayed" : "stale",
    stale_threshold_seconds: threshold,
    candle_age_seconds: ageSeconds,
    reason: "Latest closed MT5 candle is older than the timeframe-aware freshness window.",
  };
};

module.exports = {
  MT5_SOURCE,
  SUPPORTED_TIMEFRAMES,
  TIMEFRAME_SECONDS,
  FRESHNESS_DELAY_SECONDS,
  normalizeSymbol,
  normalizeTimeframe,
  validateSymbolAndTimeframe,
  getBrokerSymbol,
  getNextExpectedClose,
  getClosedCandleCutoff,
  classifyCandleFreshness,
};
