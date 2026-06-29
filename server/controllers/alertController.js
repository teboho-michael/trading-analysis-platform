const pool = require("../db/connection");
const read = async (req, res, latest = false) => {
  try {
    const limit = latest ? 10 : Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const result = await pool.query(`SELECT * FROM alert_events WHERE severity <> 'state' ${req.query.symbol ? "AND symbol = $2" : ""} ORDER BY created_at DESC LIMIT $1`, req.query.symbol ? [limit, req.query.symbol] : [limit]);
    res.json({ success: true, alerts: result.rows });
  } catch (error) { res.status(error.code === "42P01" ? 503 : 500).json({ success: false, error: error.code === "42P01" ? "Alert migration 005 has not been applied" : error.message }); }
};
const getAlertHistory = (req, res) => read(req, res, false);
const getLatestAlerts = (req, res) => read(req, res, true);
module.exports = { getAlertHistory, getLatestAlerts };
