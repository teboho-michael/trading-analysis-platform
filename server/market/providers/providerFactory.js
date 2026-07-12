const mt5BrokerProvider = require("./mt5BrokerProvider");

const getMarketDataProvider = () => {
  return mt5BrokerProvider;
};

module.exports = {
  getMarketDataProvider,
};
