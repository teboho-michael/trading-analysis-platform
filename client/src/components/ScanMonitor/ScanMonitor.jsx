export default function ScanMonitor({ latestScanRun, scanRuns }) {
  if (!latestScanRun) {
    return (
      <div className="scan-monitor">
        <h2>Market Scanner</h2>
        <p>No scan history found yet.</p>
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

        <span
          className={
            latestScanRun.status === "completed"
              ? "scan-status-success"
              : "scan-status-warning"
          }
        >
          {latestScanRun.status}
        </span>
      </div>

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