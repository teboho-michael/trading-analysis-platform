const { instrumentRegistry } = require("./instrumentRegistry");

const symbolMap = {
  XAUUSD: {
    providerSymbol: "XAU/USD",
    type: "commodity",
    priceRange: { min: 1000, max: 6000 },
  },
  BTCUSD: {
    providerSymbol: "BTC/USD",
    type: "crypto",
    priceRange: { min: 10000, max: 250000 },
  },
  USDJPY: {
    providerSymbol: "USD/JPY",
    type: "forex",
    priceRange: { min: 50, max: 300 },
  },
  US500: {
    providerSymbol: "SPY",
    type: "etf_proxy",
    priceRange: { min: 100, max: 1000 },
  },
  US100: {
    providerSymbol: "QQQ",
    type: "etf_proxy",
    priceRange: { min: 100, max: 1000 },
  },
};

const getProviderSymbol = (internalSymbol) => {
  const mappedSymbol = instrumentRegistry[internalSymbol] || symbolMap[internalSymbol];

  if (!mappedSymbol) {
    throw new Error(`No provider symbol mapping found for ${internalSymbol}`);
  }

  return mappedSymbol.providerSymbol;
};

const getSymbolMeta = (internalSymbol) => {
  const legacy = symbolMap[internalSymbol];
  const instrument = instrumentRegistry[internalSymbol];
  const mappedSymbol = legacy && instrument ? { ...legacy, ...instrument } : legacy;

  if (!mappedSymbol) {
    throw new Error(`No symbol metadata found for ${internalSymbol}`);
  }

  return mappedSymbol;
};

module.exports = {
  symbolMap,
  getProviderSymbol,
  getSymbolMeta,
};
