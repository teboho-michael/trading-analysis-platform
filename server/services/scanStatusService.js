const pool = require("../db/connection");
const { getScanState } = require("../scheduler/scanState");

const getScanStatus = async () => {
  const memory = getScanState();
  const result = await pool.query(`SELECT status, started_at, completed_at FROM market_scan_runs ORDER BY started_at DESC LIMIT 1`);
  const latest = result.rows[0];
  if (memory.running) return memory;
  return {
    ...memory,
    lastStatus: latest?.status || memory.lastStatus,
    lastSuccessfulScanAt: memory.lastSuccessfulScanAt || (latest?.status === "completed" ? latest.completed_at : null),
    lastFailedScanAt: memory.lastFailedScanAt || (latest && latest.status !== "completed" ? latest.completed_at : null),
    latestScanError: memory.latestScanError,
  };
};

module.exports = { getScanStatus };
