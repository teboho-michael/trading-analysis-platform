const pool = require("../db/connection");
const { calculateEMA } = require("../analysis/emaEngine");
const { calculateTrendFromCandles } = require("../analysis/trendEngine");
const { calculateRiskLevels } = require("../analysis/riskEngine");
const { createSignalForZone } = require("../services/signalService");
const { evaluateSetupQuality } = require("../analysis/setupQualityEngine");
const { MT5_SOURCE } = require("../services/mt5MarketMetadataService");

const fetchCandles = async (symbol, timeframe) => {
  const result = await pool.query(
    `
        SELECT candles.close, candles.candle_time
        FROM candles
        JOIN assets ON candles.asset_id = assets.id
        WHERE assets.symbol = $1
        AND candles.timeframe = $2
        AND candles.source = $3
        ORDER BY candles.candle_time DESC
        LIMIT 300
        `,
    [symbol, timeframe, MT5_SOURCE],
  );

  return result.rows;
};

const getTrendData = async (symbol, timeframe) => {
  const candles = await fetchCandles(symbol, timeframe);

  const trendData = calculateTrendFromCandles(candles, 200);

  return {
    timeframe,
    ...trendData,
  };
};

const getEmaTrend = async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;

    const candles = await fetchCandles(symbol, timeframe);

    const ema200 = calculateEMA(candles, 200);

    if (!ema200) {
      return res.json({
        success: false,
        message: "Not enough candles to calculate EMA 200",
        requiredCandles: 200,
        availableCandles: candles.length,
      });
    }

    res.json({
      success: true,
      symbol,
      timeframe,
      emaPeriod: 200,
      ema200,
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

    const trendData = await getTrendData(symbol, timeframe);

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

    const assetId = assetResult.rows[0].id;

    const daily = await getTrendData(symbol, "D1");
    const h4 = await getTrendData(symbol, "H4");
    const h1 = await getTrendData(symbol, "H1");

    const zoneResult = await pool.query(
      `
            SELECT *
            FROM zones
            WHERE asset_id = $1
            AND timeframe = 'H4'
            AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            `,
      [assetId],
    );

    const activeZone = zoneResult.rows[0] || null;

    let signal = "WAIT";

    if (
      daily.trend === "Bullish" &&
      h4.trend === "Bullish" &&
      h1.trend === "Bullish" &&
      activeZone &&
      activeZone.zone_type === "demand"
    ) {
      signal = "BUY SETUP";
    }

    if (
      daily.trend === "Bearish" &&
      h4.trend === "Bearish" &&
      h1.trend === "Bearish" &&
      activeZone &&
      activeZone.zone_type === "supply"
    ) {
      signal = "SELL SETUP";
    }

    const entryPrice = h1.lastClose;
    const risk = calculateRiskLevels(symbol, signal, entryPrice, activeZone);
    const zoneProximity = activeZone ? { isNearZone: entryPrice >= Number(activeZone.zone_low) * 0.997 && entryPrice <= Number(activeZone.zone_high) * 1.003 } : { isNearZone: false };
    const setupQuality = evaluateSetupQuality({ daily, h4, h1, activeZone, zoneProximity, risk, duplicateSignal: false });

    let savedSignal = null;

    if (risk && signal !== "WAIT") {
      const signalType = signal === "BUY SETUP" ? "BUY" : "SELL";

      const savedResult = await createSignalForZone({
        assetId,
        zoneId: activeZone.id,
        signalType,
        entryPrice: risk.entryPrice,
        stopLoss: risk.stopLoss,
        takeProfit1: risk.takeProfit1,
        takeProfit2: risk.takeProfit2,
        riskReward: 2,
        riskAmount: risk.riskAmount,
        accountRiskAmount: risk.accountRiskAmount,
        positionSizeUnits: risk.positionSizeUnits,
        positionSizeNote: risk.positionSizeNote,
      });

      savedSignal = savedResult.signal;
    }

    res.json({
      success: true,
      symbol,
      dailyBias: daily.trend,
      h4Bias: h4.trend,
      h1Trend: h1.trend,
      activeZone,
      signal,
      risk,
      savedSignal,
      ...setupQuality,
      details: {
        daily,
        h4,
        h1,
      },
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
