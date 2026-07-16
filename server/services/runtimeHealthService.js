const REASON_CODES = Object.freeze({
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  BRIDGE_HEARTBEAT_STALE: "BRIDGE_HEARTBEAT_MISSING_OR_STALE",
  TERMINAL_DISCONNECTED: "MT5_TERMINAL_DISCONNECTED",
  TICKS_NOT_FRESH: "MT5_TICKS_NOT_FRESH",
  CANDLES_MISSING: "REQUIRED_MT5_CANDLES_MISSING",
  FUTURE_TIMESTAMPS: "FUTURE_TIMESTAMP_VIOLATION",
});

const classifyRuntimeHealth = ({ database, bridge, tickStatus, candleStatus, futureViolationCount = 0 }) => {
  const reasons = [];
  if (database !== "available") reasons.push({ code: REASON_CODES.DATABASE_UNAVAILABLE, message: "Database is unavailable" });
  if (bridge?.status !== "available") reasons.push({ code: REASON_CODES.BRIDGE_HEARTBEAT_STALE, message: "Continuous MT5 bridge heartbeat is missing or stale" });
  else if (bridge.terminal_connected !== true) reasons.push({ code: REASON_CODES.TERMINAL_DISCONNECTED, message: "MT5 terminal is not connected" });
  if (tickStatus !== "available") reasons.push({ code: REASON_CODES.TICKS_NOT_FRESH, message: "Not all required MT5 ticks are fresh" });
  if (candleStatus !== "available") reasons.push({ code: REASON_CODES.CANDLES_MISSING, message: "Required MT5 candle coverage is incomplete" });
  if (futureViolationCount > 0) reasons.push({ code: REASON_CODES.FUTURE_TIMESTAMPS, message: "Future-normalized tick or candle timestamps detected" });
  return {
    applicationStatus: database === "unavailable" ? "unavailable" : reasons.length ? "degraded" : "available",
    reasons,
  };
};

module.exports = { REASON_CODES, classifyRuntimeHealth };
