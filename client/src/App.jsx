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
const TRACKED_ASSETS = new Set(["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"]);
const CHART_TIMEFRAMES = new Set(["M1", "M5", "M15", "H1", "H4", "D1"]);
const initialParam = (name, allowed, fallback) => {
  const value = new URLSearchParams(window.location.search).get(name);
  return allowed.has(value) ? value : fallback;
};

function App() {
  const [selectedAsset, setSelectedAsset] = useState(() => initialParam("symbol", TRACKED_ASSETS, "BTCUSD"));
  const [selectedTimeframe, setSelectedTimeframe] = useState(() => initialParam("timeframe", CHART_TIMEFRAMES, "H1"));
  const [liveMode, setLiveMode] = useState(true);
  const [chartMode, setChartMode] = useState("tradingview");
  const [analysisVisible, setAnalysisVisible] = useState(true);
  const [historyVisible, setHistoryVisible] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

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
          <button type="button" onClick={() => setAnalysisVisible((value) => !value)}>{analysisVisible ? "Hide analysis" : "Show analysis"}</button>
          <button type="button" onClick={() => setHistoryVisible((value) => !value)}>{historyVisible ? "Hide history" : "Show history"}</button>
          <button type="button" className={focusMode ? "active" : ""} onClick={() => setFocusMode((value) => !value)}>{focusMode ? "Exit focus" : "Focus chart"}</button>
        </div>
      </header>

      <main className={`trading-workspace${!analysisVisible ? " analysis-hidden" : ""}${!historyVisible ? " history-hidden" : ""}${focusMode ? " terminal-focus" : ""}`}>
        {!focusMode && <Watchlist
          dashboard={dashboard}
          selectedAsset={selectedAsset}
          selectedLatestPrice={latestPrice}
          onSelect={setSelectedAsset}
          livePrices={activeLivePrices}
          movements={live.movements}
        />}

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
          chartMode={chartMode}
          onChartModeChange={setChartMode}
        />

        {!focusMode && analysisVisible && <AnalysisPanel asset={selectedAssetData} latestPrice={latestPrice} liveQuote={selectedLiveQuote} />}
        {!focusMode && <LowerTabs selectedSymbol={selectedAsset} collapsed={!historyVisible} onToggleCollapsed={() => setHistoryVisible((value) => !value)} />}
      </main>
    </div>
  );
}

export default App;
