const { getLivePrices } = require("../market/livePriceService");
const { getScanStatus } = require("../services/scanStatusService");

const getPrices = async (req, res) => {
  try {
    const symbols = req.query.symbols ? [...new Set(req.query.symbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))] : undefined;
    const result = await getLivePrices(symbols);
    res.json({ success: true, ...result, lastScan: await getScanStatus(), serverTimestamp: new Date().toISOString() });
  } catch (error) {
    const brokerUnavailable = error.message.includes("MT5_BRIDGE_ERROR");
    res.status(error.statusCode || (brokerUnavailable ? 503 : 502)).json({ success: false, error: error.message, details: error.details || null, fallbackUsed: false, serverTimestamp: new Date().toISOString() });
  }
};

module.exports = { getPrices };
