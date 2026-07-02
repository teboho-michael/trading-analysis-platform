const { collectCandlesForAsset } = require("../market/candleCollector");
const { runMarketScan } = require("../scheduler/marketScanner");
const { ProviderError, serializeProviderError } = require("../market/providers/providerError");

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
    const providerCode = error.code || error.message?.split(":", 1)[0];
    const legacyStatusCodes = {
      PLAN_LIMIT: 402,
      RATE_LIMIT: 429,
      UNSUPPORTED_SYMBOL: 422,
      INVALID_SYMBOL: 422,
      BAD_PROVIDER_RESPONSE: 502,
      UNKNOWN_PROVIDER_ERROR: 502,
    };

    if (error instanceof ProviderError || legacyStatusCodes[providerCode]) {
      const statusCode = error.statusCode || error.httpStatus || legacyStatusCodes[providerCode] || 502;
      return res.status(statusCode).json({
        success: false,
        ...serializeProviderError(error),
      });
    }
    const status = error.message?.includes("DATA_VALIDATION_ERROR") ? 422 : 500;

    res.status(status).json({
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
