const pool = require("../db/connection");
const { getEmaState, getH1Confirmation } = require("../services/coreEmaService");
const { buildSetup, recordCoreAlerts } = require("../services/coreSetupService");

const getEmaTrend = async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const state = await getEmaState(symbol, timeframe);
    res.json({
      success: state.trend_state !== "insufficient_data",
      symbol,
      timeframe,
      emaPeriod: 200,
      ...state,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTrendSignal = async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const trendData = timeframe === "H1" ? await getH1Confirmation(symbol) : await getEmaState(symbol, timeframe);

    res.json({
      success: true,
      symbol,
      timeframe,
      ...trendData,
      signalRule: "Two consecutive candle closes above/below EMA 200",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTradeSetup = async (req, res) => {
  try {
    const { symbol } = req.params;
    const assetResult = await pool.query(
      "SELECT id FROM assets WHERE symbol = $1",
      [symbol],
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }
    const setup = await buildSetup(symbol);
    await recordCoreAlerts(symbol, setup);
    res.json({
      success: true,
      symbol,
      ...setup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getEmaTrend,
  getTrendSignal,
  getTradeSetup,
};
