const { getLatestTicks } = require("../services/liveTickService");
const { getInstrument } = require("./instrumentRegistry");

const getLivePrices = async (requestedSymbols) => {
  const result = await getLatestTicks(requestedSymbols);
  return {
    ...result,
    prices: result.prices.map((quote) => {
      const instrument = getInstrument(quote.symbol);
      return {
        ...quote,
        providerSymbol: instrument.providerSymbol,
        analysisProviderSymbol: instrument.activeAnalysisSymbol,
        dataSource: instrument.dataSourceLabel,
        priceScaleMode: instrument.priceScaleMode,
        sourceMode: instrument.sourceMode,
        dataModeLabel: instrument.dataModeLabel,
        syncStatus: instrument.syncStatus,
        dataTruthNote: instrument.dataTruthNote,
      };
    }),
  };
};

module.exports = { getLivePrices };
