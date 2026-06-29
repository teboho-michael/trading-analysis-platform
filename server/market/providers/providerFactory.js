const mockProvider = require("./mockProvider");
const twelveDataProvider = require("./twelveDataProvider");
const mt5BrokerProvider = require("./mt5BrokerProvider");
const { normalizeProviderMode } = require("../instrumentRegistry");

const getMarketDataProvider = () => {
  const providerName = normalizeProviderMode();

  if (providerName === "mock") {
    return mockProvider;
  }

  if (providerName === "twelve") {
    return twelveDataProvider;
  }
  if (providerName === "broker_mt5") return mt5BrokerProvider;
  throw new Error(`UNSUPPORTED_MARKET_PROVIDER: ${providerName}`);
};

module.exports = {
  getMarketDataProvider,
};
