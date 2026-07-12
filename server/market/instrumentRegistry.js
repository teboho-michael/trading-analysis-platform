const PROVIDER_LABELS = {
  mock: "Mock",
  broker_mt5: "MT5 Broker",
};

const normalizeProviderMode = (_value = process.env.MARKET_PROVIDER || "broker_mt5") => {
  return "broker_mt5";
};

const normalizeLegacyProviderMode = (value = process.env.MARKET_PROVIDER || "broker_mt5") => {
  const mode = String(value).toLowerCase();
  if (mode === "broker_mt5") return "broker_mt5";
  return "broker_mt5";
};

const base = {
  brokerServer: "XMGLOBAL-MT5 4",
  accountCurrency: "ZAR",
  contractSize: null,
  minLot: null,
  lotStep: null,
};

const instrumentRegistry = {
  BTCUSD: { ...base, platformSymbol: "BTCUSD", symbol: "BTCUSD", displaySymbol: "BTCUSD", displayName: "Bitcoin / US Dollar", tradingViewSymbol: "BINANCE:BTCUSDT", analysisProvider: "broker_mt5", analysisProviderSymbol: "Bitcoin", providerSymbol: "Bitcoin", brokerSymbolFuture: "Bitcoin", brokerSymbol: "Bitcoin", priceScaleMode: "broker_direct", sourceMode: "mt5_broker", assetClass: "crypto", isProxy: false, proxySymbol: null, priceRange: { min: 10000, max: 250000 }, priceDecimals: 2, pipSize: 1, tickSize: null, contractSize: 1, sizingMode: "crypto", brokerNote: "XM account mapping uses Bitcoin.", dataTruthNote: "Research evidence uses MT5 broker candles only.", note: "TradingView remains a visual chart feed; research and readiness use MT5 broker candles." },
  XAUUSD: { ...base, platformSymbol: "XAUUSD", symbol: "XAUUSD", displaySymbol: "XAUUSD", displayName: "Gold Spot / U.S. Dollar", tradingViewSymbol: "OANDA:XAUUSD", analysisProvider: "broker_mt5", analysisProviderSymbol: "Goldmicro", providerSymbol: "Goldmicro", brokerSymbolFuture: "Goldmicro", brokerSymbol: "Goldmicro", priceScaleMode: "broker_direct", sourceMode: "mt5_broker", assetClass: "commodity", isProxy: false, proxySymbol: null, priceRange: { min: 1000, max: 6000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 100, sizingMode: "commodity", brokerNote: "XM account mapping uses Goldmicro.", dataTruthNote: "Research evidence uses MT5 broker candles only.", note: "Provider and broker symbols are attributed to MT5 broker source metadata." },
  USDJPY: { ...base, platformSymbol: "USDJPY", symbol: "USDJPY", displaySymbol: "USDJPY", displayName: "U.S. Dollar / Japanese Yen", tradingViewSymbol: "OANDA:USDJPY", analysisProvider: "broker_mt5", analysisProviderSymbol: "USDJPY", providerSymbol: "USDJPY", brokerSymbolFuture: "USDJPY", brokerSymbol: "USDJPY", priceScaleMode: "broker_direct", sourceMode: "mt5_broker", assetClass: "forex", isProxy: false, proxySymbol: null, priceRange: { min: 50, max: 300 }, priceDecimals: 3, pipSize: 0.01, tickSize: null, contractSize: 100000, sizingMode: "forex", brokerNote: "XM account mapping uses USDJPY.", dataTruthNote: "Research evidence uses MT5 broker candles only.", note: "Direct broker mapping; prices depend on MT5 bridge availability." },
  US500: { ...base, platformSymbol: "US500", symbol: "US500", displaySymbol: "US500", displayName: "US 500 Index", tradingViewSymbol: "OANDA:SPX500USD", analysisProvider: "broker_mt5", analysisProviderSymbol: "US500", providerSymbol: "US500", brokerSymbolFuture: "US500", brokerSymbol: "US500", priceScaleMode: "broker_direct", sourceMode: "mt5_broker", assetClass: "index", isProxy: false, proxySymbol: null, priceRange: { min: 1000, max: 15000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 1, sizingMode: "index", brokerNote: "XM MT5 instrument US500.", dataTruthNote: "Research evidence uses MT5 broker candles only.", note: "Direct broker-index mapping; no proxy fallback is used." },
  US100: { ...base, platformSymbol: "US100", symbol: "US100", displaySymbol: "US100", displayName: "US Tech 100 Index", tradingViewSymbol: "OANDA:NAS100USD", analysisProvider: "broker_mt5", analysisProviderSymbol: "US100", providerSymbol: "US100", brokerSymbolFuture: "US100", brokerSymbol: "US100", priceScaleMode: "broker_direct", sourceMode: "mt5_broker", assetClass: "index", isProxy: false, proxySymbol: null, priceRange: { min: 5000, max: 50000 }, priceDecimals: 2, pipSize: 0.01, tickSize: null, contractSize: 1, sizingMode: "index", brokerNote: "XM MT5 instrument US100.", dataTruthNote: "Research evidence uses MT5 broker candles only.", note: "Direct broker-index mapping; no proxy fallback is used." },
};

const getActiveSource = (instrument, dataSourceMode) => {
  return {
    activeAnalysisProvider: "broker_mt5",
    activeAnalysisSymbol: instrument.brokerSymbolFuture,
    priceScaleMode: "broker_direct",
    sourceMode: "mt5_broker",
    dataModeLabel: "MT5 broker",
    syncStatus: "MT5-only",
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

module.exports = { instrumentRegistry, getInstrument, getSafeInstruments, normalizeProviderMode, normalizeLegacyProviderMode, PROVIDER_LABELS };
