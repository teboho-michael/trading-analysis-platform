const PROVIDER_LABELS = {
  mock: "Mock",
  twelve: "Twelve Data",
  broker_mt5: "MT5 broker bridge",
};

const normalizeProviderMode = (value = process.env.MARKET_PROVIDER || "mock") => {
  const mode = String(value).toLowerCase();
  if (["twelve", "twelvedata", "twelve_data"].includes(mode)) return "twelve";
  if (mode === "broker_mt5") return "broker_mt5";
  return "mock";
};

const base = {
  brokerServer: "XMGLOBAL-MT5 4",
  accountCurrency: "ZAR",
  contractSize: null,
  minLot: null,
  lotStep: null,
};

const instrumentRegistry = {
  US500: { ...base, symbol: "US500", displaySymbol: "US500", displayName: "S&P 500", assetClass: "index", providerSymbol: "SPY", brokerSymbol: "US500", isProxy: true, proxySymbol: "SPY", priceDecimals: 2, pipSize: 0.01, tickSize: null, brokerNote: "XM MT5 instrument US500.", dataTruthNote: "Twelve Data development mode uses SPY ETF candles as a proxy; broker mode uses XM US500." },
  US100: { ...base, symbol: "US100", displaySymbol: "US100", displayName: "Nasdaq 100", assetClass: "index", providerSymbol: "QQQ", brokerSymbol: "US100", isProxy: true, proxySymbol: "QQQ", priceDecimals: 2, pipSize: 0.01, tickSize: null, brokerNote: "XM MT5 instrument US100.", dataTruthNote: "Twelve Data development mode uses QQQ ETF candles as a proxy; broker mode uses XM US100." },
  XAUUSD: { ...base, symbol: "XAUUSD", displaySymbol: "XAUUSD", displayName: "Gold", assetClass: "commodity", providerSymbol: "XAU/USD", brokerSymbol: "Goldmicro", isProxy: false, proxySymbol: null, priceDecimals: 2, pipSize: 0.01, tickSize: null, brokerNote: "XM account mapping uses Goldmicro.", dataTruthNote: "Provider and broker symbols differ; prices must be attributed to the active source." },
  BTCUSD: { ...base, symbol: "BTCUSD", displaySymbol: "BTCUSD", displayName: "Bitcoin", assetClass: "crypto", providerSymbol: "BTC/USD", brokerSymbol: "Bitcoin", isProxy: false, proxySymbol: null, priceDecimals: 2, pipSize: 1, tickSize: null, brokerNote: "XM account mapping uses Bitcoin.", dataTruthNote: "Provider and broker symbols differ; prices must be attributed to the active source." },
  USDJPY: { ...base, symbol: "USDJPY", displaySymbol: "USDJPY", displayName: "USD/JPY", assetClass: "forex", providerSymbol: "USD/JPY", brokerSymbol: "USDJPY", isProxy: false, proxySymbol: null, priceDecimals: 3, pipSize: 0.01, tickSize: null, brokerNote: "XM account mapping uses USDJPY.", dataTruthNote: "Direct symbol mapping; prices still depend on the active provider." },
};

const getInstrument = (symbol) => {
  const instrument = instrumentRegistry[String(symbol).toUpperCase()];
  if (!instrument) throw new Error(`UNKNOWN_INSTRUMENT: ${symbol}`);
  const dataSourceMode = normalizeProviderMode();
  return { ...instrument, dataSourceMode, dataSourceLabel: PROVIDER_LABELS[dataSourceMode], isProxy: dataSourceMode === "twelve" && instrument.isProxy };
};

const getSafeInstruments = () => Object.keys(instrumentRegistry).map((symbol) => {
  const item = getInstrument(symbol);
  return { symbol: item.symbol, displaySymbol: item.displaySymbol, displayName: item.displayName, providerSymbol: item.providerSymbol, brokerSymbol: item.brokerSymbol, dataSourceMode: item.dataSourceMode, dataSourceLabel: item.dataSourceLabel, isProxy: item.isProxy, proxySymbol: item.isProxy ? item.proxySymbol : null, brokerNote: item.brokerNote, dataTruthNote: item.dataTruthNote };
});

module.exports = { instrumentRegistry, getInstrument, getSafeInstruments, normalizeProviderMode, PROVIDER_LABELS };
