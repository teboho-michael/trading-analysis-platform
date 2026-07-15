const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");
const { buildSetup, setupToDashboardFields } = require("../services/coreSetupService");

const getLatestSignal = async (assetId) => {
  const result = await pool.query(
    `
        SELECT *
        FROM signals
        WHERE asset_id = $1
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        `,
    [assetId],
  );

  return result.rows[0] || null;
};

const buildAssetAnalysis = async (asset) => {
  const latestSignal = await getLatestSignal(asset.id);
  const setup = await buildSetup(asset.symbol);
  const status =
    setup.signal === "BUY" || setup.signal === "SELL" ? "Active" : "Monitoring";
  const instrument = getInstrument(asset.symbol);
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    status,
    latestPrice: setup.live_price,
    latestSignal,
    ...setupToDashboardFields(setup),
    instrument: {
      platformSymbol: instrument.platformSymbol,
      symbol: instrument.symbol,
      displayName: instrument.displayName,
      analysisProvider: instrument.activeAnalysisProvider,
      analysisProviderSymbol: instrument.activeAnalysisSymbol,
      providerSymbol: instrument.providerSymbol,
      brokerSymbolFuture: instrument.brokerSymbolFuture,
      brokerSymbol: instrument.brokerSymbol,
      priceScaleMode: instrument.priceScaleMode,
      assetClass: instrument.assetClass,
      sourceMode: instrument.sourceMode,
      dataModeLabel: instrument.dataModeLabel,
      syncStatus: instrument.syncStatus,
      dataSourceMode: instrument.dataSourceMode,
      dataSourceLabel: instrument.dataSourceLabel,
      isProxy: false,
      priceRange: instrument.priceRange,
      dataTruthNote: instrument.dataTruthNote,
      note: instrument.note,
    },
  };
};

const getDashboard = async (req, res) => {
  try {
    const assetsResult = await pool.query(
      `
            SELECT *
            FROM assets
            ORDER BY id ASC
            `,
    );

    const dashboard = [];

    for (const asset of assetsResult.rows) {
      const analysis = await buildAssetAnalysis(asset);
      dashboard.push(analysis);
    }

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getDashboard,
};
