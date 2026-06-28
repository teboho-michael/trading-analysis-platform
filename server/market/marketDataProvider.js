const { getProvider } = require("./providers/providerFactory");

const getLatestCandles = async (symbol, timeframe) => {
  const provider = getProvider();

  return provider.getLatestCandles(symbol, timeframe);
};

module.exports = {
  getLatestCandles,
};
