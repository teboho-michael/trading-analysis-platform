import { useState } from "react";
import Chart from "./Chart";
import ChartToolbar from "./ChartToolbar";
import { collectMarketData } from "../../services/marketService";

export default function TradingChartPanel({
  dashboard,
  candles,
  candlesLoading,
  candlesError,
  selectedAsset,
  selectedTimeframe,
  selectedAssetData,
  onAssetChange,
  onTimeframeChange,
  onDataCollected,
}) {
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const latestPrice = candles.at(-1)?.close;
  const activeZone =
    selectedAssetData?.activeZone?.status === "active" &&
    !selectedAssetData.activeZone.broken_at &&
    !selectedAssetData.activeZone.mitigated_at
      ? selectedAssetData.activeZone
      : null;

  const handleCollectData = async () => {
    try {
      setCollecting(true);
      setMessage("");

      const result = await collectMarketData(selectedAsset, selectedTimeframe);

      setMessage(result.message || "Market data collected successfully.");
      setMessageType("success");

      onDataCollected();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to collect market data.",
      );
      setMessageType("error");
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="chart-section">
      <div className="chart-header">
        <h2>
          {selectedAsset} {selectedTimeframe} Chart
        </h2>

        <div className="toolbar">
          <ChartToolbar
            dashboard={dashboard}
            selectedAsset={selectedAsset}
            selectedTimeframe={selectedTimeframe}
            onAssetChange={onAssetChange}
            onTimeframeChange={onTimeframeChange}
          />

          <button onClick={handleCollectData} disabled={collecting}>
            {collecting ? "Collecting..." : "Collect Latest Data"}
          </button>
        </div>
      </div>

      <div className="chart-context" aria-live="polite">
        <span>
          Latest price: <strong>{latestPrice ?? "—"}</strong>
        </span>
        <span>
          Active zone: <strong>{activeZone?.zone_type || "None"}</strong>
        </span>
        <span>
          Signal: <strong>{selectedAssetData?.latestSignal?.signal_type || "None"}</strong>
        </span>
      </div>

      {message && (
        <p className={`status-message ${messageType}`} role="status">
          {message}
        </p>
      )}

      {candlesLoading ? (
        <div className="chart-state" role="status">
          Loading {selectedAsset} {selectedTimeframe} candles…
        </div>
      ) : candlesError ? (
        <div className="chart-state error" role="alert">
          <strong>Chart unavailable.</strong>
          <span>{candlesError}</span>
        </div>
      ) : candles.length > 0 ? (
        <Chart
          candles={candles}
          activeZone={activeZone}
          risk={selectedAssetData?.risk}
          latestSignal={selectedAssetData?.latestSignal}
        />
      ) : (
        <div className="chart-state">
          No candles found for {selectedAsset} {selectedTimeframe}.
        </div>
      )}
    </div>
  );
}
