const pool = require("../db/connection");

const getAllSignals = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
                signals.id,
                assets.symbol,
                signals.signal_type,
                signals.entry_price,
                signals.stop_loss,
                signals.take_profit_1,
                signals.take_profit_2,
                signals.risk_reward,
                signals.status,
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
      signal_type,
      entry_price,
      stop_loss,
      take_profit_1,
      take_profit_2,
      risk_reward,
      status,
    } = req.body;

    const result = await pool.query(
      `
            INSERT INTO signals
            (asset_id, signal_type, entry_price, stop_loss, take_profit_1, take_profit_2, risk_reward, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'active'))
            RETURNING *
            `,
      [
        asset_id,
        signal_type,
        entry_price,
        stop_loss,
        take_profit_1,
        take_profit_2,
        risk_reward,
        status,
      ],
    );

    res.status(201).json({
      success: true,
      signal: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllSignals,
  addSignal,
};
