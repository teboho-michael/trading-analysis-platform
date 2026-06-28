const pool = require("../db/connection");

const getSignalMonitor = async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT 
                s.id,
                s.zone_id,
                a.symbol,
                s.signal_type,
                s.entry_price,
                s.stop_loss,
                s.take_profit_1,
                s.take_profit_2,
                s.risk_reward,
                s.status,
                s.closed_at,
                s.exit_price,
                s.outcome_reason,
                s.created_at
            FROM signals s
            JOIN assets a ON a.id = s.asset_id
            ORDER BY s.created_at DESC
            LIMIT 30
            `,
    );

    const activeSignals = result.rows.filter(
      (signal) => signal.status === "active",
    );

    const expiredSignals = result.rows.filter(
      (signal) => signal.status === "expired",
    );

    res.json({
      success: true,
      activeSignals,
      expiredSignals,
      signals: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getSignalMonitor,
};
