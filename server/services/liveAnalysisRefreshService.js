const { recalculateEmaStates } = require("./coreEmaService");
const { saveZonesForSymbol } = require("./coreZoneService");
const { buildSetup, recordCoreAlerts } = require("./coreSetupService");
const { getLatestTicks } = require("./liveTickService");

const refreshConfirmedAnalysis = async (symbol) => {
  const quote = (await getLatestTicks([symbol])).prices[0];
  await recalculateEmaStates(symbol);
  await saveZonesForSymbol(symbol, quote?.status === "live" ? quote.display_price : null);
  const setup = await buildSetup(symbol);
  await recordCoreAlerts(symbol, setup);
  return { symbol, refreshed: true, source: "confirmed_mt5_candles" };
};

module.exports = { refreshConfirmedAnalysis };
