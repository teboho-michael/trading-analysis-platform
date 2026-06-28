const pool = require("../db/connection");

const getScanRuns = async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT *
            FROM market_scan_runs
            ORDER BY id DESC
            LIMIT 20
            `,
    );

    res.json({
      success: true,
      scanRuns: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getLatestScanRun = async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT *
            FROM market_scan_runs
            ORDER BY id DESC
            LIMIT 1
            `,
    );

    res.json({
      success: true,
      latestScanRun: result.rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getScanRuns,
  getLatestScanRun,
};
