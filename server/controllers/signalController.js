const pool = require("../db/connection");
const { createSignalForZone } = require("../services/signalService");

const getAllSignals = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
                signals.id,
                signals.zone_id,
                assets.symbol,
                signals.signal_type,
                signals.entry_price,
                signals.stop_loss,
                signals.take_profit_1,
                signals.take_profit_2,
                signals.risk_reward,
                signals.status,
                signals.closed_at,
                signals.exit_price,
                signals.outcome_reason,
                signals.created_at
            FROM signals
            JOIN assets ON signals.asset_id = assets.id
            ORDER BY signals.created_at DESC
        `);

    res.json({
      success: true,
      signals: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const addSignal = async (req, res) => {
  try {
    const {
      asset_id,
      zone_id,
      signal_type,
      entry_price,
      stop_loss,
      take_profit_1,
      take_profit_2,
      risk_reward,
      status,
    } = req.body;

    const result = await createSignalForZone({
      assetId: asset_id,
      zoneId: zone_id,
      signalType: signal_type,
      entryPrice: entry_price,
      stopLoss: stop_loss,
      takeProfit1: take_profit_1,
      takeProfit2: take_profit_2,
      riskReward: risk_reward,
      status: status || "active",
    });

    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      signal: result.signal,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllSignals,
  addSignal,
};
