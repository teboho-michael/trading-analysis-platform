const REQUIRED_SYMBOLS = ["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"];

const asArray = (value) => Array.isArray(value) ? value : [];
const isLiveTick = (tick) => tick?.status === "live" && tick?.is_fresh === true;
const isMarketClosedTick = (tick) => tick?.status === "market_closed";

const evaluateCoreHealthAcceptance = (health = {}, options = {}) => {
  const requiredSymbols = options.requiredSymbols || REQUIRED_SYMBOLS;
  const failures = [];
  const warnings = [];
  const addFailure = (name, detail) => failures.push({ name, detail: String(detail ?? "failed") });
  const addWarning = (name, detail) => warnings.push({ name, detail: String(detail ?? "warning") });

  if (health.application_status !== "available") addFailure("application_status", health.application_status || "missing");
  if (health.database_status !== "available") addFailure("database", health.database_status || "missing");
  if (health.mt5_terminal_status !== "available") addFailure("mt5-terminal", health.mt5_terminal_status || "missing");
  if (health.continuous_bridge_status !== "available") addFailure("continuous-bridge", health.continuous_bridge_status || "missing");
  if (Number(health.continuous_bridge_process_count) !== 1) addFailure("bridge-process-count", health.continuous_bridge_process_count ?? "missing");
  if (!health.continuous_bridge_heartbeat) addFailure("bridge-heartbeat", "missing");
  if (health.mt5_tick_status !== "available") addFailure("mt5-ticks", health.mt5_tick_status || "missing");
  if (health.mt5_candles !== "available") addFailure("mt5-candles", health.mt5_candles || "missing");

  const reasonCodes = asArray(health.degradation_reason_codes);
  if (reasonCodes.length) addFailure("core-degradation-reason-codes", reasonCodes.join(","));

  const futureViolations = asArray(health.future_timestamp_violations);
  if (futureViolations.length) addFailure("future-timestamps", futureViolations.length);

  const ticks = asArray(health.latest_tick_by_symbol);
  const bySymbol = new Map(ticks.map((tick) => [tick.symbol || tick.platform_symbol, tick]));
  for (const symbol of requiredSymbols) {
    const tick = bySymbol.get(symbol);
    if (!tick) {
      addFailure(`tick-${symbol}`, "missing");
    } else if (!isLiveTick(tick) && !isMarketClosedTick(tick)) {
      addFailure(`tick-${symbol}`, tick.status || "not-live");
    }
  }

  const staleWarnings = asArray(health.stale_warnings);
  if (staleWarnings.length) addFailure("stale-warnings", staleWarnings.length);

  const optionalWarnings = asArray(health.optional_warnings);
  for (const warning of optionalWarnings) addWarning(warning.name || "optional", warning.detail || warning.message || "optional warning");

  return { passed: failures.length === 0, failures, warnings };
};

module.exports = { REQUIRED_SYMBOLS, evaluateCoreHealthAcceptance };
