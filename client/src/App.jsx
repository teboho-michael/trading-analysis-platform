import { useState } from "react";
import TradingChartPanel from "./components/Chart/TradingChartPanel";
import AnalysisPanel from "./components/Analysis/AnalysisPanel";
import Watchlist from "./components/Watchlist/Watchlist";
import { useDashboard } from "./hooks/useDashboard";
import { useCandles } from "./hooks/useCandles";
import "./App.css";
import LowerTabs from "./components/Workspace/LowerTabs";

function App() {
  const [selectedAsset, setSelectedAsset] = useState("BTCUSD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("H1");

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
  const latestPrice = selectedCandles.at(-1)?.close;

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
        <span className="data-source">Data source: {selectedAssetData?.instrument?.dataSourceLabel || "Unknown"}</span>
      </header>

      <main className="trading-workspace">
        <Watchlist
          dashboard={dashboard}
          selectedAsset={selectedAsset}
          selectedLatestPrice={latestPrice}
          onSelect={setSelectedAsset}
        />

        <TradingChartPanel
          candles={selectedCandles}
          candlesLoading={candlesLoading}
          candlesError={candlesError}
          selectedAsset={selectedAsset}
          selectedTimeframe={selectedTimeframe}
          selectedAssetData={selectedAssetData}
          onTimeframeChange={setSelectedTimeframe}
          onDataCollected={handleDataCollected}
        />

        <AnalysisPanel asset={selectedAssetData} latestPrice={latestPrice} />
        <LowerTabs selectedSymbol={selectedAsset} />
      </main>
    </div>
  );
}

export default App;
