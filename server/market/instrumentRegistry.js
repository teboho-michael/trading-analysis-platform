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
  BTCUSD: { ...base, platformSymbol: "BTCUSD", symbol: "BTCUSD", displaySymbol: "BTCUSD", displayName: "Bitcoin / US Dollar", tradingViewSymbol: "BINANCE:BTCUSDT", analysisProvider: "twelve", analysisProviderSymbol: "BTC/USD", providerSymbol: "BTC/USD", brokerSymbolFuture: "Bitcoin", brokerSymbol: "Bitcoin", priceScaleMode: "direct", sourceMode: "twelve_direct", assetClass: "crypto", isProxy: false, proxySymbol: null, priceRange: { min: 10000, max: 250000 }, priceDecimals: 2, pipSize: 1, tickSize: null, contractSize: 1, sizingMode: "crypto", brokerNote: "XM account mapping uses Bitcoin.", dataTruthNote: "Chart and analysis are aligned by direct symbol.", note: "Twelve Data analysis uses direct BTC/USD-equivalent data while TradingView displays BTCUSDT/BTCUSD venue pricing." },
  XAUUSD: { ...base, platformSymbol: "XAUUSD", symbol: "XAUUSD", displaySymbol: "XAUUSD", displayName: "Gold Spot / U.S. Dollar", tradingViewSymbol: "OANDA:XAUUSD", analysisProvider: "twelve", analysisProviderSymbol: "XAU/USD", providerSymbol: "XAU/USD", brokerSymbolFuture: "Goldmicro", brokerSymbol: "Goldmicro", priceScaleMode: "direct", sourceMode: "twelve_direct", assetClass: "commodity", isProxy: false, proxySymbol: null, priceRange: { min: 1000, max: 6000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 100, sizingMode: "commodity", brokerNote: "XM account mapping uses Goldmicro.", dataTruthNote: "Chart and analysis are aligned by direct symbol.", note: "Direct spot gold scale; provider and broker symbols differ and must be attributed to the active source." },
  USDJPY: { ...base, platformSymbol: "USDJPY", symbol: "USDJPY", displaySymbol: "USDJPY", displayName: "U.S. Dollar / Japanese Yen", tradingViewSymbol: "OANDA:USDJPY", analysisProvider: "twelve", analysisProviderSymbol: "USD/JPY", providerSymbol: "USD/JPY", brokerSymbolFuture: "USDJPY", brokerSymbol: "USDJPY", priceScaleMode: "direct", sourceMode: "twelve_direct", assetClass: "forex", isProxy: false, proxySymbol: null, priceRange: { min: 50, max: 300 }, priceDecimals: 3, pipSize: 0.01, tickSize: null, contractSize: 100000, sizingMode: "forex", brokerNote: "XM account mapping uses USDJPY.", dataTruthNote: "Chart and analysis are aligned by direct symbol.", note: "Direct USD/JPY mapping; prices still depend on the active provider." },
  US500: { ...base, platformSymbol: "US500", symbol: "US500", displaySymbol: "US500", displayName: "US 500 Index", tradingViewSymbol: "OANDA:SPX500USD", analysisProvider: "twelve", analysisProviderSymbol: "SPX", providerSymbol: "SPX", brokerSymbolFuture: "US500", brokerSymbol: "US500", priceScaleMode: "direct", sourceMode: "twelve_direct", assetClass: "index", isProxy: false, proxySymbol: null, priceRange: { min: 1000, max: 15000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 1, sizingMode: "index", brokerNote: "XM MT5 instrument US500.", dataTruthNote: "Chart and analysis are aligned by direct symbol.", note: "Direct index-scale mapping. Collection fails clearly if the configured index symbol is unavailable." },
  US100: { ...base, platformSymbol: "US100", symbol: "US100", displaySymbol: "US100", displayName: "US Tech 100 Index", tradingViewSymbol: "OANDA:NAS100USD", analysisProvider: "twelve", analysisProviderSymbol: "NDX", providerSymbol: "NDX", brokerSymbolFuture: "US100", brokerSymbol: "US100", priceScaleMode: "direct", sourceMode: "twelve_direct", assetClass: "index", isProxy: false, proxySymbol: null, priceRange: { min: 5000, max: 50000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 1, sizingMode: "index", brokerNote: "XM MT5 instrument US100.", dataTruthNote: "Chart and analysis are aligned by direct symbol.", note: "Direct index-scale mapping. Collection fails clearly if the configured index symbol is unavailable." },
};

const getActiveSource = (instrument, dataSourceMode) => {
  if (dataSourceMode === "broker_mt5") {
    return {
      activeAnalysisProvider: "broker_mt5",
      activeAnalysisSymbol: instrument.brokerSymbolFuture,
      priceScaleMode: "broker_future",
      sourceMode: "broker_mt5_future",
      dataModeLabel: "Broker future",
      syncStatus: "Different source / approximate",
    };
  }

  const isProxy = instrument.priceScaleMode === "proxy";

  return {
    activeAnalysisProvider: instrument.analysisProvider,
    activeAnalysisSymbol: instrument.analysisProviderSymbol,
    priceScaleMode: instrument.priceScaleMode,
    sourceMode: instrument.sourceMode,
    dataModeLabel: isProxy ? "Proxy data" : "Direct market data",
    syncStatus: isProxy ? "Proxy aligned" : "Aligned",
  };
};

const getInstrument = (symbol) => {
  const instrument = instrumentRegistry[String(symbol).toUpperCase()];
  if (!instrument) throw new Error(`UNKNOWN_INSTRUMENT: ${symbol}`);
  const dataSourceMode = normalizeProviderMode();
  const activeSource = getActiveSource(instrument, dataSourceMode);
  const isProxy = activeSource.priceScaleMode === "proxy";
  return {
    ...instrument,
    ...activeSource,
    providerSymbol: activeSource.activeAnalysisSymbol,
    brokerSymbol: instrument.brokerSymbolFuture,
    dataSourceMode,
    dataSourceLabel: PROVIDER_LABELS[dataSourceMode],
    isProxy,
    proxySymbol: isProxy ? instrument.proxySymbol : null,
  };
};

const getSafeInstruments = () => Object.keys(instrumentRegistry).map((symbol) => {
  const item = getInstrument(symbol);
  return { platformSymbol: item.platformSymbol, symbol: item.symbol, displaySymbol: item.displaySymbol, displayName: item.displayName, tradingViewSymbol: item.tradingViewSymbol, analysisProvider: item.activeAnalysisProvider, analysisProviderSymbol: item.activeAnalysisSymbol, providerSymbol: item.providerSymbol, brokerSymbolFuture: item.brokerSymbolFuture, brokerSymbol: item.brokerSymbol, priceScaleMode: item.priceScaleMode, assetClass: item.assetClass, sourceMode: item.sourceMode, dataModeLabel: item.dataModeLabel, syncStatus: item.syncStatus, dataSourceMode: item.dataSourceMode, dataSourceLabel: item.dataSourceLabel, isProxy: item.isProxy, proxySymbol: item.isProxy ? item.proxySymbol : null, priceRange: item.priceRange, brokerNote: item.brokerNote, dataTruthNote: item.dataTruthNote, note: item.note };
});

module.exports = { instrumentRegistry, getInstrument, getSafeInstruments, normalizeProviderMode, PROVIDER_LABELS };
