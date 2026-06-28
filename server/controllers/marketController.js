const { collectCandlesForAsset } = require("../market/candleCollector");
const { runMarketScan } = require("../scheduler/marketScanner");

const collectMarketData = async (req, res) => {
  try {
    const { symbol, timeframe } = req.body;

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
    res.status(500).json({
      success: false,
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  collectMarketData,
  scanMarket,
};
