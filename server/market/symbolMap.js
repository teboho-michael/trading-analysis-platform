const symbolMap = {
  XAUUSD: {
    providerSymbol: "XAU/USD",
    type: "commodity",
  },
  BTCUSD: {
    providerSymbol: "BTC/USD",
    type: "crypto",
  },
  USDJPY: {
    providerSymbol: "USD/JPY",
    type: "forex",
  },
  US500: {
    providerSymbol: "SPY",
    type: "etf_proxy",
  },
  US100: {
    providerSymbol: "QQQ",
    type: "etf_proxy",
  },
};

const getProviderSymbol = (internalSymbol) => {
  const mappedSymbol = symbolMap[internalSymbol];

  if (!mappedSymbol) {
    throw new Error(`No provider symbol mapping found for ${internalSymbol}`);
  }

  return mappedSymbol.providerSymbol;
};

const getSymbolMeta = (internalSymbol) => {
  const mappedSymbol = symbolMap[internalSymbol];

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
