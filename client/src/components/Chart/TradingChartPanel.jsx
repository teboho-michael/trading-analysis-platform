import { useState } from "react";
import Chart from "./Chart";
import ChartToolbar from "./ChartToolbar";
import { collectMarketData } from "../../services/marketService";

export default function TradingChartPanel({
  dashboard,
  candles,
  selectedAsset,
  selectedTimeframe,
  selectedAssetData,
  onAssetChange,
  onTimeframeChange,
  onDataCollected,
}) {
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");

  const handleCollectData = async () => {
    try {
      setCollecting(true);
      setMessage("");

      const result = await collectMarketData(selectedAsset, selectedTimeframe);

      setMessage(result.message || "Market data collected successfully.");

      onDataCollected();
    } catch (error) {
      console.error(error);
      setMessage("Failed to collect market data.");
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

      {message && <p className="status-message">{message}</p>}

      {candles.length > 0 ? (
        <Chart
          candles={candles}
          activeZone={selectedAssetData?.activeZone}
          risk={selectedAssetData?.risk}
          latestSignal={selectedAssetData?.latestSignal}
        />
      ) : (
        <p>No candles found for {selectedAsset} {selectedTimeframe}</p>
      )}
    </div>
  );
}