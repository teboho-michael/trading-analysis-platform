const mockProvider = require("./mockProvider");
const twelveDataProvider = require("./twelveDataProvider");

const getMarketDataProvider = () => {
  const providerName = process.env.MARKET_PROVIDER || "mock";

  if (providerName === "mock") {
    return mockProvider;
  }

  if (
    providerName === "twelve" ||
    providerName === "twelvedata" ||
    providerName === "twelve_data"
  ) {
    return twelveDataProvider;
  }

  return mockProvider;
};

module.exports = {
  getMarketDataProvider,
};
