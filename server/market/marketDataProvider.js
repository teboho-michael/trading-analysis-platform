const { getMarketDataProvider } = require("./providers/providerFactory");

const getLatestCandles = async (symbol, timeframe) => {
  const provider = getMarketDataProvider();

  return provider.getCandles(symbol, timeframe);
};

module.exports = {
  getLatestCandles,
};
