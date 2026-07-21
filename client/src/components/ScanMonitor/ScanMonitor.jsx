import { useState } from "react";
import { runMarketScan } from "../../services/marketService";

export default function ScanMonitor({
  latestScanRun,
  scanRuns = [],
  onScanCompleted,
}) {
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleScan = async () => {
    try {
      setScanning(true);
      setFeedback(null);

      const result = await runMarketScan();
      const scanRun = result.results?.scanRun;

      setFeedback({
        type: "success",
        message: `Scan completed: ${scanRun?.successful_collections ?? 0}/${scanRun?.total_collections ?? 15} collections successful.`,
      });
      onScanCompleted?.();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Market scan failed.",
      });
    } finally {
      setScanning(false);
    }
  };

  if (!latestScanRun) {
    return (
      <div className="scan-monitor">
        <div className="scan-monitor-header">
          <h2>Market Scanner</h2>
          <button type="button" onClick={handleScan} disabled={scanning}>
            {scanning ? "Scanning…" : "Run Full Scan"}
          </button>
        </div>
        <p>No scan history found yet.</p>
        {feedback && (
          <p className={`scan-feedback ${feedback.type}`} role="status">
            {feedback.message}
          </p>
        )}
      </div>
    );
  }

  const completedAt = latestScanRun.completed_at
    ? new Date(latestScanRun.completed_at).toLocaleString()
    : "Not completed";

  return (
    <div className="scan-monitor">
      <div className="scan-monitor-header">
        <h2>Market Scanner</h2>

        <div className="scan-actions">
          <span
            className={
              latestScanRun.status === "completed"
                ? "scan-status-success"
                : "scan-status-warning"
            }
          >
            {latestScanRun.status}
          </span>
          <button type="button" onClick={handleScan} disabled={scanning}>
            {scanning ? "Scanning…" : "Run Full Scan"}
          </button>
        </div>
      </div>

      {scanning && (
        <p className="scan-feedback" role="status">
          Full live scan is running. This can take several minutes.
        </p>
      )}

      {feedback && (
        <p className={`scan-feedback ${feedback.type}`} role="status">
          {feedback.message}
        </p>
      )}

      <div className="scan-summary-grid">
        <div className="scan-summary-card">
          <span>Type</span>
          <strong>{latestScanRun.scan_type}</strong>
        </div>

        <div className="scan-summary-card">
          <span>Collections</span>
          <strong>
            {latestScanRun.successful_collections}/
            {latestScanRun.total_collections}
          </strong>
        </div>

        <div className="scan-summary-card">
          <span>Failed</span>
          <strong>{latestScanRun.failed_collections}</strong>
        </div>

        <div className="scan-summary-card">
          <span>Signals Created</span>
          <strong>{latestScanRun.signals_created}</strong>
        </div>

        <div className="scan-summary-card wide">
          <span>Completed</span>
          <strong>{completedAt}</strong>
        </div>
      </div>

      <div className="recent-scans">
        <h3>Recent Scan Runs</h3>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Collections</th>
              <th>Signals</th>
              <th>Completed</th>
            </tr>
          </thead>

          <tbody>
            {scanRuns.slice(0, 5).map((scan) => (
              <tr key={scan.id}>
                <td>{scan.id}</td>
                <td>{scan.scan_type}</td>
                <td>{scan.status}</td>
                <td>
                  {scan.successful_collections}/{scan.total_collections}
                </td>
                <td>{scan.signals_created}</td>
                <td>
                  {scan.completed_at
                    ? new Date(scan.completed_at).toLocaleTimeString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
