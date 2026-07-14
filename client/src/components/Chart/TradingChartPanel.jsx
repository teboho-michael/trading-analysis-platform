import { useState } from "react";
import Chart from "./Chart";
import ChartToolbar from "./ChartToolbar";
import { collectMarketData } from "../../services/marketService";

const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "—";

export default function TradingChartPanel({
  candles,
  candleMetadata,
  candlesLoading,
  candlesError,
  selectedAsset,
  selectedTimeframe,
  selectedAssetData,
  onTimeframeChange,
  onDataCollected,
  liveQuote,
  liveStatus,
}) {
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const latestPrice = liveQuote?.price ?? candles.at(-1)?.close;
  const isForming = candles.at(-1)?.isForming === true;
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
      const mt5Unavailable = ["awaiting_mt5_candles", "stale_mt5_candles", "unavailable"].includes(error.response?.data?.status);
      setMessage(
        mt5Unavailable
          ? "MT5 broker data is unavailable or stale. Check the VPS bridge sync."
          : error.response?.data?.error ||
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

      <div className="chart-metadata" aria-live="polite">
        <span><small>Platform</small><strong>{selectedAsset}</strong></span>
        <span><small>Broker</small><strong>{candleMetadata?.brokerSymbol || selectedAssetData?.instrument?.brokerSymbol || "—"}</strong></span>
        <span><small>Timeframe</small><strong>{selectedTimeframe}</strong></span>
        <span><small>Source</small><strong>XM MT5</strong></span>
        <span><small>Latest candle</small><strong>{formatDateTime(candleMetadata?.latestStoredCandleTime)}</strong></span>
        <span><small>Freshness</small><strong>{candleMetadata?.freshness || "checking"}</strong></span>
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
        <span className={isForming ? "forming-status" : ""}>
          Candle <strong>{isForming ? "Forming · unconfirmed" : "Confirmed history"}</strong>
        </span>
        <span>
          Live <strong>{liveQuote?.status || liveStatus}</strong>
        </span>
        <span>
          Closed <strong>{formatDateTime(candleMetadata?.latestClosedCandleTime)}</strong>
        </span>
      </div>

      {message && (
        <p className={`status-message ${messageType}`} role="status">
          {message}
        </p>
      )}

      {["awaiting_mt5_tick", "stale_mt5_tick", "unavailable"].includes(liveQuote?.status) && !message && (
        <p className="status-message error" role="status">
          {liveQuote?.message || "MT5 live tick is unavailable. Latest candle close is shown separately."}
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
          No MT5 candle data is available for this asset and timeframe.
        </div>
      )}
    </section>
  );
}
