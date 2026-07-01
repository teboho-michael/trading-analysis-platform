const { instrumentRegistry } = require("./instrumentRegistry");

const symbolMap = Object.fromEntries(
  Object.entries(instrumentRegistry).map(([symbol, instrument]) => [
    symbol,
    {
      providerSymbol: instrument.analysisProviderSymbol,
      type: instrument.assetClass,
      priceRange: instrument.priceRange,
      priceScaleMode: instrument.priceScaleMode,
      sourceMode: instrument.sourceMode,
    },
  ]),
);

const getProviderSymbol = (internalSymbol) => {
  const mappedSymbol = symbolMap[internalSymbol];

  if (!mappedSymbol) {
    throw new Error(`No provider symbol mapping found for ${internalSymbol}`);
  }

  return mappedSymbol.providerSymbol;
};

const getSymbolMeta = (internalSymbol) => {
  const legacy = symbolMap[internalSymbol];
  const instrument = instrumentRegistry[internalSymbol];
  const mappedSymbol = legacy && instrument ? {
    ...instrument,
    ...legacy,
    brokerSymbol: instrument.brokerSymbolFuture,
  } : legacy;

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
