const { importCandles } = require("../services/mt5BrokerImportService");
const { importTicks } = require("../services/liveTickService");
const { getSymbolMap } = require("../services/mt5SymbolMapService");
const { recordHeartbeat } = require("../services/bridgeRuntimeService");

const requireBridgeSecret = (req, res) => {
  const expected = process.env.MT5_BRIDGE_SECRET;
  const provided = req.get("x-mt5-bridge-secret");

  if (!expected || !provided || provided !== expected) {
    res.status(401).json({
      success: false,
      error: "Missing or invalid MT5 bridge secret",
    });
    return false;
  }

  return true;
};

const importMt5Candles = async (req, res) => {
  if (!requireBridgeSecret(req, res)) return;

  try {
    const summary = await importCandles(req.body || {});
    res.status(201).json({ success: true, import: summary });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      details: error.details || null,
    });
  }
};

const importMt5Ticks = async (req, res) => {
  if (!requireBridgeSecret(req, res)) return;

  try {
    const summary = await importTicks(req.body || {});
    res.status(summary.rejected_count ? 207 : 201).json({ success: summary.inserted_count > 0, import: summary });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      details: error.details || null,
    });
  }
};

const getMt5SymbolMap = (_req, res) => {
  res.json({ success: true, symbol_map: getSymbolMap() });
};

const heartbeat = async (req, res) => {
  if (!requireBridgeSecret(req, res)) return;
  try { res.json({ success: true, runtime: await recordHeartbeat(req.body || {}) }); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message, details: error.details || null }); }
};

module.exports = {
  getMt5SymbolMap,
  importMt5Candles,
  importMt5Ticks,
  heartbeat,
};
