const { collectCandlesForAsset } = require("../market/candleCollector");
const { runMarketScan } = require("../scheduler/marketScanner");
const { instrumentRegistry } = require("../market/instrumentRegistry");
const { getLivePrices } = require("../market/livePriceService");
const { recalculateEmaStates } = require("../services/coreEmaService");
const { saveZonesForSymbol } = require("../services/coreZoneService");
const { buildSetup, recordCoreAlerts } = require("../services/coreSetupService");

const TIMEFRAMES = ["D1", "H4", "H1"];

const runCoreRefresh = async (symbol, requestedTimeframe) => {
  const startedAt = new Date().toISOString();
  const symbols = symbol ? [String(symbol).toUpperCase()] : Object.keys(instrumentRegistry);
  const timeframes = requestedTimeframe ? [String(requestedTimeframe).toUpperCase()] : TIMEFRAMES;
  const summary = {
    success: true,
    started_at: startedAt,
    completed_at: null,
    symbols_processed: 0,
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
  summary.ticks_updated = liveResult.prices.filter((quote) => quote.status === "live").length;

  for (const currentSymbol of symbols) {
    const liveQuote = liveResult.prices.find((quote) => quote.symbol === currentSymbol);
    const symbolResult = { symbol: currentSymbol, timeframes: [], tick_status: liveQuote?.status || "unavailable" };
    for (const timeframe of timeframes) {
      try {
        const collection = await collectCandlesForAsset(currentSymbol, timeframe);
        symbolResult.timeframes.push({
          timeframe,
          status: "collected",
          candles_saved: collection.candlesSaved,
          candles_inserted: collection.candles.filter((row) => row.inserted).length,
          candles_updated: collection.candles.filter((row) => !row.inserted).length,
        });
        summary.candles_inserted += collection.candles.filter((row) => row.inserted).length;
        summary.candles_updated += collection.candles.filter((row) => !row.inserted).length;
      } catch (error) {
        symbolResult.timeframes.push({ timeframe, status: "failed", error: error.message });
        summary.failures.push({ symbol: currentSymbol, timeframe, error: error.message });
      }
    }
    try {
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
    }
    summary.symbols_processed += 1;
    summary.results.push(symbolResult);
  }
  summary.success = summary.failures.length === 0 || summary.symbols_processed > 0;
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
    res.status(result.failures.length ? 207 : 200).json({
      ...result,
      message: `${symbol || "All symbols"} ${timeframe || "D1/H4/H1"} core refresh completed`,
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
