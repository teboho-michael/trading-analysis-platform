const pool = require("../db/connection");
const mt5Provider = require("../market/providers/mt5BrokerProvider");
const { getSafeInstruments, normalizeProviderMode, PROVIDER_LABELS } = require("../market/instrumentRegistry");
const { getScanStatus } = require("../services/scanStatusService");

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
  res.status(healthy ? 200 : 503).json({ success: healthy, backend: "available", database, providerMode: mode, providerLabel: PROVIDER_LABELS[mode], bridge, lastScan, timestamp: new Date().toISOString() });
};

module.exports = { getInstruments, providerStatus, health };
