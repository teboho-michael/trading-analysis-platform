const assetSpecs = {
  XAUUSD: {
    displayName: "Gold",
    priceDecimals: 2,
    pipSize: 0.01,
    contractSize: 100,
    sizingMode: "commodity",
    note: "Gold sizing is broker-dependent. V1 uses contract-size estimate.",
  },

  BTCUSD: {
    displayName: "Bitcoin",
    priceDecimals: 2,
    pipSize: 1,
    contractSize: 1,
    sizingMode: "crypto",
    note: "BTC sizing uses coin/unit exposure.",
  },

  USDJPY: {
    displayName: "USD/JPY",
    priceDecimals: 3,
    pipSize: 0.01,
    contractSize: 100000,
    sizingMode: "forex",
    note: "Forex sizing uses standard lot contract estimate.",
  },

  US500: {
    displayName: "S&P 500 Proxy",
    priceDecimals: 2,
    pipSize: 0.01,
    contractSize: 1,
    sizingMode: "etf_proxy",
    providerProxy: "SPY",
    note: "US500 currently uses SPY proxy because SPX requires higher provider plan.",
  },

  US100: {
    displayName: "NASDAQ 100 Proxy",
    priceDecimals: 2,
    pipSize: 0.01,
    contractSize: 1,
    sizingMode: "etf_proxy",
    providerProxy: "QQQ",
    note: "US100 currently uses QQQ proxy because NDX requires higher provider plan.",
  },
};

const getAssetSpec = (symbol) => {
  const spec = assetSpecs[symbol];

  if (!spec) {
    throw new Error(`No asset specification found for ${symbol}`);
  }

  return spec;
};

module.exports = {
  assetSpecs,
  getAssetSpec,
};
