import { useState } from "react";
import Chart from "./Chart";
import ChartToolbar from "./ChartToolbar";
import { collectMarketData } from "../../services/marketService";

export default function TradingChartPanel({
  candles,
  candlesLoading,
  candlesError,
  selectedAsset,
  selectedTimeframe,
  selectedAssetData,
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
    <section className="chart-section panel-shell">
      <div className="chart-header">
        <div>
          <span className="eyebrow">Price chart</span>
          <h2>{selectedAsset}</h2>
        </div>

        <div className="toolbar">
          <ChartToolbar
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={onTimeframeChange}
          />

          <button onClick={handleCollectData} disabled={collecting}>
            {collecting ? "Collecting..." : "Collect Latest Data"}
          </button>
        </div>
      </div>

      <div className="chart-context" aria-live="polite">
        <span className="latest-quote">
          <small>Latest close</small>
          <strong>{latestPrice ?? "—"}</strong>
        </span>
        <span>
          Zone <strong>{activeZone?.zone_type || "None"}</strong>
        </span>
        <span>
          Signal <strong>{selectedAssetData?.latestSignal?.signal_type || selectedAssetData?.signal || "None"}</strong>
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
    </section>
  );
}
