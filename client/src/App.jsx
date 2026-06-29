import { useState } from "react";
import TradingChartPanel from "./components/Chart/TradingChartPanel";
import AnalysisPanel from "./components/Analysis/AnalysisPanel";
import Watchlist from "./components/Watchlist/Watchlist";
import { useDashboard } from "./hooks/useDashboard";
import { useCandles } from "./hooks/useCandles";
import "./App.css";
import LowerTabs from "./components/Workspace/LowerTabs";
import { useLivePrices } from "./hooks/useLivePrices";
import { useFormingCandles } from "./hooks/useFormingCandles";

const formatTime = (value) => value ? new Date(value).toLocaleTimeString() : "—";

function App() {
  const [selectedAsset, setSelectedAsset] = useState("BTCUSD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("H1");
  const [liveMode, setLiveMode] = useState(true);

  const { dashboard, loading, error, refreshDashboard } = useDashboard();
  const {
    candles,
    loading: candlesLoading,
    error: candlesError,
    refreshCandles,
  } = useCandles(
    selectedAsset,
    selectedTimeframe,
  );

  const selectedAssetData = dashboard.find(
    (asset) => asset.symbol === selectedAsset,
  );
  const selectedCandles =
    candles.length === 0 || candles[0]?.symbol === selectedAsset ? candles : [];
  const live = useLivePrices(liveMode);
  const activeLivePrices = liveMode ? live.prices : {};
  const selectedLiveQuote = activeLivePrices[selectedAsset];
  const visibleCandles = useFormingCandles(selectedCandles, selectedLiveQuote, selectedAsset, selectedTimeframe, liveMode);
  const latestPrice = selectedLiveQuote?.price ?? visibleCandles.at(-1)?.close;

  const handleDataCollected = () => {
    refreshDashboard();
    refreshCandles();
  };

  if (loading) {
    return (
      <div className="app-state" role="status">
        Loading trading workspace…
      </div>
    );
  }

  if (error && dashboard.length === 0) {
    return (
      <div className="app-state error" role="alert">
        <strong>Dashboard unavailable</strong>
        <span>{error}</span>
        <button type="button" onClick={refreshDashboard}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="platform-header">
        <div>
          <span className="brand-mark" aria-hidden="true" />
          <h1>Trading Analysis Platform</h1>
        </div>
        <div className="live-controls">
          <span className={`connection-state connection-${live.status}`} title={live.error || "Live provider connection status"}>{live.status}</span>
          <span>Data: {selectedLiveQuote?.dataSource || selectedAssetData?.instrument?.dataSourceLabel || "Unknown"}</span>
          <span>Price: {formatTime(live.lastUpdated)}</span>
          <span>Scan: {formatTime(live.lastScan?.lastSuccessfulScanAt)}</span>
          <button type="button" className={liveMode ? "active" : ""} onClick={() => setLiveMode((value) => !value)}>Live mode: {liveMode ? "On" : "Off"}</button>
        </div>
      </header>

      <main className="trading-workspace">
        <Watchlist
          dashboard={dashboard}
          selectedAsset={selectedAsset}
          selectedLatestPrice={latestPrice}
          onSelect={setSelectedAsset}
          livePrices={activeLivePrices}
          movements={live.movements}
        />

        <TradingChartPanel
          candles={visibleCandles}
          candlesLoading={candlesLoading}
          candlesError={candlesError}
          selectedAsset={selectedAsset}
          selectedTimeframe={selectedTimeframe}
          selectedAssetData={selectedAssetData}
          onTimeframeChange={setSelectedTimeframe}
          onDataCollected={handleDataCollected}
          liveQuote={selectedLiveQuote}
          liveStatus={live.status}
        />

        <AnalysisPanel asset={selectedAssetData} latestPrice={latestPrice} liveQuote={selectedLiveQuote} />
        <LowerTabs selectedSymbol={selectedAsset} />
      </main>
    </div>
  );
}

export default App;
