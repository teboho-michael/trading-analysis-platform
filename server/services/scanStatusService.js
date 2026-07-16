const pool = require("../db/connection");
const { getScanState } = require("../scheduler/scanState");

const getScanStatus = async () => {
  const memory = getScanState();
  const [result, coreResult] = await Promise.all([
    pool.query(`SELECT status, started_at, completed_at FROM market_scan_runs ORDER BY started_at DESC LIMIT 1`),
    pool.query(`SELECT MAX(calculated_at) AS completed_at FROM core_ema_states`),
  ]);
  const latest = result.rows[0];
  const coreCompletedAt = coreResult.rows[0]?.completed_at || null;
  const completedCandidates = [memory.lastSuccessfulScanAt, latest?.status === "completed" ? latest.completed_at : null, coreCompletedAt]
    .filter(Boolean)
    .map((value) => new Date(value));
  const lastSuccessfulScanAt = completedCandidates.length
    ? new Date(Math.max(...completedCandidates.map((value) => value.getTime()))).toISOString()
    : null;
  if (memory.running) return memory;
  return {
    ...memory,
    lastStatus: lastSuccessfulScanAt ? "completed" : latest?.status || memory.lastStatus,
    lastSuccessfulScanAt,
    latestCoreRefreshAt: coreCompletedAt,
    lastFailedScanAt: memory.lastFailedScanAt || (latest && latest.status !== "completed" ? latest.completed_at : null),
    latestScanError: memory.latestScanError,
  };
};

module.exports = { getScanStatus };
