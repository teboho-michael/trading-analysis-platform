const pool = require("../db/connection");
const mt5Provider = require("../market/providers/mt5BrokerProvider");
const { getSafeInstruments, normalizeProviderMode, PROVIDER_LABELS } = require("../market/instrumentRegistry");
const { getScanStatus } = require("../services/scanStatusService");
const { MT5_SOURCE, candleCountsBySource, evidencePolicy } = require("../services/mt5EvidencePolicy");
const {
  classifyCandleFreshness,
  getNextExpectedClose,
} = require("../services/mt5MarketMetadataService");

const getInstruments = (req, res) => res.json({ success: true, instruments: getSafeInstruments() });

const bridgeStatus = async (mode) => {
  if (mode !== "broker_mt5") return { required: false, status: "not_applicable" };
  try { return { required: true, status: "available", details: await mt5Provider.getHealth() }; }
  catch (error) { return { required: true, status: "unavailable", error: error.message }; }
};

const providerStatus = async (req, res) => {
  const mode = normalizeProviderMode();
  const bridge = await bridgeStatus(mode);
  res.status(mode === "broker_mt5" && bridge.status === "unavailable" ? 503 : 200).json({ success: bridge.status !== "unavailable", mode, label: PROVIDER_LABELS[mode], bridge, fallbackEnabled: false });
};

const health = async (req, res) => {
  const mode = normalizeProviderMode();
  let database = "available";
  try { await pool.query("SELECT 1"); } catch (_error) { database = "unavailable"; }
  const bridge = await bridgeStatus(mode);
  const healthy = database === "available" && bridge.status !== "unavailable";
  const lastScan = database === "available" ? await getScanStatus() : null;
  let latestMt5Candles = [];
  let nonMt5CandleCounts = [];
  let latestBridgeRuns = [];
  if (database === "available") {
    latestMt5Candles = (await pool.query(
      `
        SELECT
          a.symbol,
          c.timeframe,
          MAX(c.candle_time) AS latest_candle_time,
          MAX(c.candle_time) FILTER (WHERE c.candle_time <= CURRENT_TIMESTAMP - CASE c.timeframe WHEN 'H1' THEN INTERVAL '1 hour' WHEN 'H4' THEN INTERVAL '4 hours' ELSE INTERVAL '1 day' END) AS latest_closed_candle_time,
          COUNT(*)::int AS mt5_candle_count
        FROM candles c
        JOIN assets a ON a.id=c.asset_id
        WHERE c.source=$1
        GROUP BY a.symbol,c.timeframe
        ORDER BY a.symbol,c.timeframe
      `,
      [MT5_SOURCE],
    )).rows;
    nonMt5CandleCounts = (await pool.query(
      `
        SELECT COALESCE(c.source,'unknown') AS source,a.symbol,c.timeframe,COUNT(*)::int AS candle_count
        FROM candles c
        JOIN assets a ON a.id=c.asset_id
        WHERE c.source IS DISTINCT FROM $1
        GROUP BY COALESCE(c.source,'unknown'),a.symbol,c.timeframe
        ORDER BY source,a.symbol,c.timeframe
      `,
      [MT5_SOURCE],
    )).rows;
    try {
      latestBridgeRuns = (await pool.query(
        `
          SELECT DISTINCT ON (platform_symbol,timeframe)
            platform_symbol AS symbol,
            broker_symbol,
            timeframe,
            started_at,
            completed_at,
            success,
            received_count,
            inserted_count,
            updated_count,
            rejected_count,
            latest_candle_time
          FROM mt5_bridge_runs
          WHERE success = TRUE
          ORDER BY platform_symbol,timeframe,completed_at DESC
        `,
      )).rows;
    } catch (_error) {
      latestBridgeRuns = [];
    }
  }
  latestMt5Candles = latestMt5Candles.map((item) => {
    const latestClosed = item.latest_closed_candle_time || null;
    const latestStored = item.latest_candle_time || null;
    const freshness = classifyCandleFreshness({
      timeframe: item.timeframe,
      latestClosedCandleTime: latestClosed,
      candleCount: item.mt5_candle_count,
    });
    return {
      ...item,
      latest_stored_candle_time: latestStored,
      latest_closed_candle_time: latestClosed,
      forming_candle_present: Boolean(latestStored && latestClosed && String(latestStored) !== String(latestClosed)),
      forming_candle_time: latestStored && latestClosed && String(latestStored) !== String(latestClosed) ? latestStored : null,
      next_expected_close_time: getNextExpectedClose(item.timeframe, latestClosed || latestStored),
      ...freshness,
    };
  });
  const staleWarnings = latestMt5Candles
    .filter((item) => ["delayed", "stale", "missing", "awaiting_first_sync"].includes(item.freshness))
    .map((item) => ({ symbol: item.symbol, timeframe: item.timeframe, status: item.freshness, latest_candle_time: item.latest_candle_time, latest_closed_candle_time: item.latest_closed_candle_time, reason: item.reason }));
  const bridgeLastSuccess = latestBridgeRuns.reduce((latest, item) => {
    if (!latest) return item.completed_at;
    return new Date(item.completed_at) > new Date(latest) ? item.completed_at : latest;
  }, null);
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    application_status: healthy ? "available" : "degraded",
    backend: "available",
    database_status: database,
    mt5_only_mode_enabled: true,
    providerMode: mode,
    providerLabel: PROVIDER_LABELS[mode],
    bridge,
    bridge_last_success: bridgeLastSuccess,
    latest_bridge_runs: latestBridgeRuns,
    latest_mt5_candles: latestMt5Candles,
    stale_data_warnings: staleWarnings,
    non_mt5_candle_counts: nonMt5CandleCounts,
    lastScan,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    ...evidencePolicy(),
  });
};

const dataSources = async (_req, res) => {
  try {
    res.json({
      success: true,
      active_source: MT5_SOURCE,
      disabled_sources: [{ source: "twelve_data", status: "removed" }],
      candle_counts_by_source: await candleCountsBySource(),
      ...evidencePolicy(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getInstruments, providerStatus, health, dataSources };
