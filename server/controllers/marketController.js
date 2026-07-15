const pool = require("../db/connection");
const { runMarketScan } = require("../scheduler/marketScanner");
const { instrumentRegistry } = require("../market/instrumentRegistry");
const { getLivePrices } = require("../market/livePriceService");
const { recalculateEmaStates } = require("../services/coreEmaService");
const { saveZonesForSymbol } = require("../services/coreZoneService");
const { buildSetup, recordCoreAlerts } = require("../services/coreSetupService");
const { MT5_SOURCE } = require("../services/mt5EvidencePolicy");
const { classifyCandleFreshness } = require("../services/mt5MarketMetadataService");

const TIMEFRAMES = ["D1", "H4", "H1"];

const getStoredCandleStatus = async (symbol, timeframe) => {
  const result = await pool.query(
    `SELECT
       a.symbol,
       c.timeframe,
       COUNT(*)::int AS candle_count,
       MAX(c.candle_time) AS latest_candle_time,
       MAX(c.candle_time) FILTER (WHERE c.candle_time <= CURRENT_TIMESTAMP - CASE c.timeframe WHEN 'H1' THEN INTERVAL '1 hour' WHEN 'H4' THEN INTERVAL '4 hours' ELSE INTERVAL '1 day' END) AS latest_closed_candle_time
     FROM candles c
     JOIN assets a ON a.id = c.asset_id
     WHERE a.symbol = $1 AND c.timeframe = $2 AND c.source = $3
     GROUP BY a.symbol,c.timeframe`,
    [symbol, timeframe, MT5_SOURCE],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      timeframe,
      status: "missing",
      candle_count: 0,
      latest_candle_time: null,
      latest_closed_candle_time: null,
      freshness: "awaiting_first_sync",
      current: false,
    };
  }
  const freshness = classifyCandleFreshness({
    timeframe,
    latestClosedCandleTime: row.latest_closed_candle_time,
    latestStoredCandleTime: row.latest_candle_time,
    candleCount: row.candle_count,
    liveTicksAvailable: true,
  });
  return {
    timeframe,
    status: freshness.freshness,
    candle_count: row.candle_count,
    latest_candle_time: row.latest_candle_time,
    latest_closed_candle_time: row.latest_closed_candle_time,
    ...freshness,
    current: ["current", "forming"].includes(freshness.freshness),
  };
};

const runCoreRefresh = async (symbol, requestedTimeframe) => {
  const startedAt = new Date().toISOString();
  const symbols = symbol ? [String(symbol).toUpperCase()] : Object.keys(instrumentRegistry);
  const timeframes = requestedTimeframe ? [String(requestedTimeframe).toUpperCase()] : TIMEFRAMES;
  const summary = {
    success: true,
    started_at: startedAt,
    completed_at: null,
    symbols_processed: 0,
    refresh_status: "running",
    candle_import_triggered: false,
    candle_data_status: "checking",
    ticks_available: 0,
    ticks_updated: 0,
    candles_inserted: 0,
    candles_updated: 0,
    ema_updated: 0,
    zones_created: 0,
    zones_updated: 0,
    setups_updated: 0,
    alerts_created: 0,
    results: [],
    failures: [],
  };

  const liveResult = await getLivePrices(symbols);
  summary.ticks_available = liveResult.prices.filter((quote) => quote.status === "live").length;
  summary.ticks_updated = 0;

  for (const currentSymbol of symbols) {
    const liveQuote = liveResult.prices.find((quote) => quote.symbol === currentSymbol);
    const symbolResult = { symbol: currentSymbol, timeframes: [], tick_status: liveQuote?.status || "unavailable" };
    for (const timeframe of timeframes) {
      try {
        const candleStatus = await getStoredCandleStatus(currentSymbol, timeframe);
        symbolResult.timeframes.push(candleStatus);
        if (!candleStatus.candle_count) {
          summary.failures.push({ symbol: currentSymbol, timeframe, step: "stored_mt5_candles", error: "No stored MT5 broker candles are available. Run the MT5 Python bridge sync." });
        }
      } catch (error) {
        symbolResult.timeframes.push({ timeframe, status: "failed", error: error.message });
        summary.failures.push({ symbol: currentSymbol, timeframe, step: "stored_mt5_candles", error: error.message });
      }
    }
    try {
      if (symbolResult.timeframes.some((item) => !item.candle_count)) {
        throw new Error("Required stored MT5 candles are unavailable for analysis refresh");
      }
      const emaStates = await recalculateEmaStates(currentSymbol);
      summary.ema_updated += emaStates.length;
      const zones = await saveZonesForSymbol(currentSymbol, liveQuote?.price);
      summary.zones_created += zones.zones_created;
      summary.zones_updated += zones.zones_updated;
      const setup = await buildSetup(currentSymbol);
      const alerts = await recordCoreAlerts(currentSymbol, setup);
      summary.setups_updated += 1;
      summary.alerts_created += alerts.length;
      symbolResult.zone_reason = zones.reason;
      symbolResult.setup = { signal: setup.signal, stage: setup.stage, quality_score: setup.quality_score, status: setup.status };
    } catch (error) {
      summary.failures.push({ symbol: currentSymbol, step: "core_recalculation", error: error.message });
      symbolResult.analysis_status = "failed";
    }
    summary.symbols_processed += 1;
    summary.results.push(symbolResult);
  }
  const analysisFailures = summary.failures.filter((failure) => failure.step === "core_recalculation").length;
  const totalSymbols = symbols.length;
  summary.candle_data_status = summary.results.every((item) => item.timeframes.every((tf) => tf.candle_count > 0)) ? "available" : "unavailable";
  summary.refresh_status = summary.failures.length === 0 ? "completed" : analysisFailures >= totalSymbols ? "failed" : "partial";
  summary.success = summary.refresh_status !== "failed";
  summary.completed_at = new Date().toISOString();
  return summary;
};

const collectMarketData = async (req, res) => {
  try {
    const { symbol, timeframe } = req.body || {};

    if ((symbol && !timeframe) || (!symbol && timeframe)) {
      return res.status(400).json({
        success: false,
        message: "symbol and timeframe must be provided together, or omit both to refresh all core markets",
      });
    }

    const result = await runCoreRefresh(symbol, timeframe);
    const status = result.refresh_status === "completed" ? 200 : result.candle_data_status === "unavailable" ? 503 : 207;
    res.status(status).json({
      ...result,
      message: result.refresh_status === "completed"
        ? `${symbol || "All symbols"} ${timeframe || "D1/H4/H1"} core analysis refresh completed`
        : `${symbol || "All symbols"} ${timeframe || "D1/H4/H1"} core analysis refresh ${result.refresh_status}`,
    });
  } catch (error) {
    const status = error.message?.includes("DATA_VALIDATION_ERROR") ? 422 : error.message?.includes("MT5_BRIDGE_ERROR") ? 503 : 500;

    res.status(status).json({
      success: false,
      status: status === 503 ? "awaiting_mt5_candles" : "failed",
      data_source: "mt5_broker",
      error: error.message,
    });
  }
};

const scanMarket = async (req, res) => {
  try {
    const results = await runMarketScan();

    res.json({
      success: true,
      message: "Market scan completed",
      results,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  collectMarketData,
  scanMarket,
  runCoreRefresh,
};
