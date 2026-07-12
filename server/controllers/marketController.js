const { collectCandlesForAsset } = require("../market/candleCollector");
const { runMarketScan } = require("../scheduler/marketScanner");

const collectMarketData = async (req, res) => {
  try {
    const { symbol, timeframe } = req.body || {};

    if (!symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        message: "symbol and timeframe are required",
      });
    }

    await collectCandlesForAsset(symbol, timeframe);

    res.json({
      success: true,
      message: `${symbol} ${timeframe} collection completed`,
    });
  } catch (error) {
    const status = error.message?.includes("DATA_VALIDATION_ERROR") ? 422 : error.message?.includes("MT5_BRIDGE_ERROR") ? 503 : 500;

    res.status(status).json({
      success: false,
      status: status === 503 ? "awaiting_mt5_sync" : "failed",
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
};
