import { useState } from "react";
import Chart from "./Chart";
import TradingViewChart from "./TradingViewChart";
import ChartToolbar from "./ChartToolbar";
import { collectMarketData } from "../../services/marketService";
import { isVisualOnlyTimeframe } from "../../config/timeframes";

export default function TradingChartPanel({
  candles,
  candlesLoading,
  candlesError,
  selectedAsset,
  selectedTimeframe,
  selectedAssetData,
  onTimeframeChange,
  onDataCollected,
  liveQuote,
  liveStatus,
  chartMode,
  onChartModeChange,
}) {
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const isVisualOnly = isVisualOnlyTimeframe(selectedTimeframe);
  const visualOnlyMessage = `${selectedTimeframe} visual only — internal analysis supports H1/H4/D1.`;

  const latestPrice = liveQuote?.price ?? candles.at(-1)?.close;
  const isForming = candles.at(-1)?.isForming === true;
  const activeZone =
    selectedAssetData?.activeZone?.status === "active" &&
    !selectedAssetData.activeZone.broken_at &&
    !selectedAssetData.activeZone.mitigated_at
      ? selectedAssetData.activeZone
      : null;

  const handleCollectData = async () => {
    if (isVisualOnly) {
      setMessage(visualOnlyMessage);
      setMessageType("success");
      return;
    }
    try {
      setCollecting(true);
      setMessage("");

      const result = await collectMarketData(selectedAsset, selectedTimeframe);

      setMessage(result.message || "Market data collected successfully.");
      setMessageType("success");

      onDataCollected();
    } catch (error) {
      const providerRateLimited = error.response?.data?.status === "rate_limited";
      setMessage(
        providerRateLimited
          ? "Provider rate limit reached. Wait and retry collection."
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
            chartMode={chartMode}
            onChartModeChange={onChartModeChange}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={onTimeframeChange}
          />

          {chartMode === "internal" && (
            <button onClick={handleCollectData} disabled={collecting || isVisualOnly} title={isVisualOnly ? visualOnlyMessage : undefined}>
              {collecting ? "Collecting..." : "Collect Latest Data"}
            </button>
          )}
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
        <span className={isForming ? "forming-status" : ""}>
          Candle <strong>{isForming ? "Forming · unconfirmed" : "Confirmed history"}</strong>
        </span>
        <span>
          Live <strong>{liveStatus}</strong>
        </span>
        <span>
          Mode <strong>{chartMode === "tradingview" ? "TradingView terminal" : "Internal analysis"}</strong>
        </span>
        <span>
          Strategy <strong>H1 closed candles</strong>
        </span>
        {isVisualOnly && <span className="forming-status">{selectedTimeframe} visual only <strong>Analysis uses H1</strong></span>}
      </div>

      {message && (
        <p className={`status-message ${messageType}`} role="status">
          {message}
        </p>
      )}

      {liveQuote?.status === "rate_limited" && !message && (
        <p className="status-message error" role="status">
          Insufficient data — provider rate limited.
        </p>
      )}

      {chartMode === "tradingview" ? (
        <TradingViewChart symbol={selectedAsset} timeframe={selectedTimeframe} />
      ) : isVisualOnly ? (
        <div className="chart-state" role="status">
          <strong>This timeframe is visual-only.</strong>
          <span>Switch to H1 for internal analysis.</span>
        </div>
      ) : candlesLoading ? (
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
