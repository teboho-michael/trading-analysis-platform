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

const getBucketStart = (timeframe, value = new Date()) => {
  const duration = TIMEFRAME_SECONDS[timeframe];
  const timestamp = new Date(value).getTime();
  if (!duration || !Number.isFinite(timestamp)) return null;
  const bucketMs = duration * 1000;
  return new Date(Math.floor(timestamp / bucketMs) * bucketMs);
};

const getLatestExpectedClosedBucket = (timeframe, now = new Date()) => {
  const bucket = getBucketStart(timeframe, now);
  return bucket ? new Date(bucket.getTime() - TIMEFRAME_SECONDS[timeframe] * 1000) : null;
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
  latestStoredCandleTime = null,
  candleCount,
  liveTicksAvailable = false,
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

  const expected = getLatestExpectedClosedBucket(timeframe, now);
  const missingBuckets = expected ? Math.max(0, Math.floor((expected.getTime() - latestTime) / (TIMEFRAME_SECONDS[timeframe] * 1000))) : 0;
  const threshold = TIMEFRAME_SECONDS[timeframe] + FRESHNESS_DELAY_SECONDS[timeframe];
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - latestTime) / 1000));
  const storedTime = latestStoredCandleTime ? new Date(latestStoredCandleTime).getTime() : NaN;
  const formingCandlePresent = Number.isFinite(storedTime) && storedTime > latestTime;

  if (liveTicksAvailable && formingCandlePresent && missingBuckets === 0) {
    return {
      freshness: "forming_current",
      market_session_status: "open",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: "Latest stored MT5 candle is forming and the previous closed candle is within the expected timeframe window.",
    };
  }

  if (timeframe === "D1" && liveTicksAvailable && missingBuckets <= 1) {
    return {
      freshness: formingCandlePresent ? "forming_current" : "current",
      market_session_status: "open",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: formingCandlePresent
        ? "Current D1 candle is forming while MT5 live ticks are arriving."
        : "Latest completed D1 candle remains current while MT5 live ticks confirm the market is open.",
    };
  }

  if (missingBuckets === 0) {
    return {
      freshness: "current",
      market_session_status: liveTicksAvailable ? "open" : "unknown",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: "Latest closed MT5 candle is within the timeframe-aware freshness window.",
    };
  }

  if (timeframe === "D1" && ageSeconds <= threshold + 3 * TIMEFRAME_SECONDS.D1) {
    return {
      freshness: "market_closed",
      market_session_status: "closed",
      stale_threshold_seconds: threshold,
      candle_age_seconds: ageSeconds,
      reason: "Daily candles can remain unchanged during broker market closures.",
    };
  }

  return {
    freshness: missingBuckets === 1 ? "delayed" : "stale",
    market_session_status: liveTicksAvailable ? "open" : "unknown",
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
  getBucketStart,
  getLatestExpectedClosedBucket,
  getClosedCandleCutoff,
  classifyCandleFreshness,
};
