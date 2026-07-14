const PROVIDER_LABELS = {
  broker_mt5: "XM MT5",
};

const normalizeProviderMode = () => "broker_mt5";
const normalizeLegacyProviderMode = () => "broker_mt5";

const base = {
  brokerServer: "XMGLOBAL-MT5 4",
  accountCurrency: "ZAR",
  analysisProvider: "broker_mt5",
  priceScaleMode: "broker_direct",
  sourceMode: "mt5_broker",
  isProxy: false,
  dataTruthNote: "Chart, analysis, and research evidence use stored XM MT5 broker candles only.",
};

const instrumentRegistry = {
  BTCUSD: {
    ...base,
    platformSymbol: "BTCUSD",
    symbol: "BTCUSD",
    displaySymbol: "BTCUSD",
    displayName: "Bitcoin / US Dollar",
    analysisProviderSymbol: "BTCUSD",
    providerSymbol: "BTCUSD",
    brokerSymbolFuture: "BTCUSD",
    brokerSymbol: "BTCUSD",
    assetClass: "crypto",
    priceRange: { min: 10000, max: 250000 },
    priceDecimals: 2,
    pipSize: 1,
    tickSize: null,
    contractSize: 1,
    sizingMode: "crypto",
    brokerNote: "XM MT5 broker mapping uses BTCUSD.",
  },
  XAUUSD: {
    ...base,
    platformSymbol: "XAUUSD",
    symbol: "XAUUSD",
    displaySymbol: "XAUUSD",
    displayName: "Gold Spot / U.S. Dollar",
    analysisProviderSymbol: "GOLDmicro",
    providerSymbol: "GOLDmicro",
    brokerSymbolFuture: "GOLDmicro",
    brokerSymbol: "GOLDmicro",
    assetClass: "commodity",
    priceRange: { min: 1000, max: 6000 },
    priceDecimals: 2,
    pipSize: 0.01,
    tickSize: null,
    contractSize: 100,
    sizingMode: "commodity",
    brokerNote: "XM MT5 broker mapping uses GOLDmicro.",
  },
  USDJPY: {
    ...base,
    platformSymbol: "USDJPY",
    symbol: "USDJPY",
    displaySymbol: "USDJPY",
    displayName: "U.S. Dollar / Japanese Yen",
    analysisProviderSymbol: "USDJPY",
    providerSymbol: "USDJPY",
    brokerSymbolFuture: "USDJPY",
    brokerSymbol: "USDJPY",
    assetClass: "forex",
    priceRange: { min: 50, max: 300 },
    priceDecimals: 3,
    pipSize: 0.01,
    tickSize: null,
    contractSize: 100000,
    sizingMode: "forex",
    brokerNote: "XM MT5 broker mapping uses USDJPY.",
  },
  US500: {
    ...base,
    platformSymbol: "US500",
    symbol: "US500",
    displaySymbol: "US500",
    displayName: "US 500 Index",
    analysisProviderSymbol: "US500Cash",
    providerSymbol: "US500Cash",
    brokerSymbolFuture: "US500Cash",
    brokerSymbol: "US500Cash",
    assetClass: "index",
    priceRange: { min: 1000, max: 15000 },
    priceDecimals: 2,
    pipSize: 0.01,
    tickSize: null,
    contractSize: 1,
    sizingMode: "index",
    brokerNote: "XM MT5 broker mapping uses US500Cash.",
  },
  US100: {
    ...base,
    platformSymbol: "US100",
    symbol: "US100",
    displaySymbol: "US100",
    displayName: "US Tech 100 Index",
    analysisProviderSymbol: "US100Cash",
    providerSymbol: "US100Cash",
    brokerSymbolFuture: "US100Cash",
    brokerSymbol: "US100Cash",
    assetClass: "index",
    priceRange: { min: 5000, max: 50000 },
    priceDecimals: 2,
    pipSize: 0.01,
    tickSize: null,
    contractSize: 1,
    sizingMode: "index",
    brokerNote: "XM MT5 broker mapping uses US100Cash.",
  },
};

const getActiveSource = (instrument) => ({
  activeAnalysisProvider: "broker_mt5",
  activeAnalysisSymbol: instrument.brokerSymbol,
  priceScaleMode: "broker_direct",
  sourceMode: "mt5_broker",
  dataModeLabel: "XM MT5 broker candles",
  syncStatus: "MT5-native",
});

const getInstrument = (symbol) => {
  const instrument = instrumentRegistry[String(symbol).toUpperCase()];
  if (!instrument) throw new Error(`UNKNOWN_INSTRUMENT: ${symbol}`);
  const dataSourceMode = normalizeProviderMode();
  const activeSource = getActiveSource(instrument, dataSourceMode);
  return {
    ...instrument,
    ...activeSource,
    providerSymbol: activeSource.activeAnalysisSymbol,
    brokerSymbol: instrument.brokerSymbolFuture,
    dataSourceMode,
    dataSourceLabel: PROVIDER_LABELS[dataSourceMode],
    isProxy: false,
  };
};

const getSafeInstruments = () => Object.keys(instrumentRegistry).map((symbol) => {
  const item = getInstrument(symbol);
  return {
    platformSymbol: item.platformSymbol,
    symbol: item.symbol,
    displaySymbol: item.displaySymbol,
    displayName: item.displayName,
    analysisProvider: item.activeAnalysisProvider,
    analysisProviderSymbol: item.activeAnalysisSymbol,
    providerSymbol: item.providerSymbol,
    brokerSymbolFuture: item.brokerSymbolFuture,
    brokerSymbol: item.brokerSymbol,
    priceScaleMode: item.priceScaleMode,
    assetClass: item.assetClass,
    sourceMode: item.sourceMode,
    dataModeLabel: item.dataModeLabel,
    syncStatus: item.syncStatus,
    dataSourceMode: item.dataSourceMode,
    dataSourceLabel: item.dataSourceLabel,
    isProxy: false,
    priceRange: item.priceRange,
    brokerNote: item.brokerNote,
    dataTruthNote: item.dataTruthNote,
  };
});

module.exports = {
  instrumentRegistry,
  getInstrument,
  getSafeInstruments,
  normalizeProviderMode,
  normalizeLegacyProviderMode,
  PROVIDER_LABELS,
};
