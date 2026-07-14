import { useEffect, useState } from "react";
import TradingChartPanel from "./components/Chart/TradingChartPanel";
import AnalysisPanel from "./components/Analysis/AnalysisPanel";
import Watchlist from "./components/Watchlist/Watchlist";
import { useDashboard } from "./hooks/useDashboard";
import { useCandles } from "./hooks/useCandles";
import "./App.css";
import LowerTabs from "./components/Workspace/LowerTabs";
import { useLivePrices } from "./hooks/useLivePrices";
import { useFormingCandles } from "./hooks/useFormingCandles";
import { CHART_TIMEFRAMES, getAnalysisTimeframe } from "./config/timeframes";
import api from "./services/api";

const formatTime = (value) => value ? new Date(value).toLocaleTimeString() : "—";
const TRACKED_ASSETS = new Set(["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"]);
const ALLOWED_CHART_TIMEFRAMES = new Set(CHART_TIMEFRAMES);
const initialParam = (name, allowed, fallback) => {
  const value = new URLSearchParams(window.location.search).get(name);
  return allowed.has(value) ? value : fallback;
};

function App() {
  const [selectedAsset, setSelectedAsset] = useState(() => initialParam("symbol", TRACKED_ASSETS, "BTCUSD"));
  const [selectedTimeframe, setSelectedTimeframe] = useState(() => initialParam("timeframe", ALLOWED_CHART_TIMEFRAMES, "H1"));
  const [liveMode, setLiveMode] = useState(true);
  const [analysisVisible, setAnalysisVisible] = useState(true);
  const [historyVisible, setHistoryVisible] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [journalRefreshToken, setJournalRefreshToken] = useState(0);
  const [systemHealth, setSystemHealth] = useState(null);

  const { dashboard, loading, error, refreshDashboard } = useDashboard();
  const {
    candles,
    metadata: candleMetadata,
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
  const selectedFreshness = systemHealth?.latest_mt5_candles?.find((item) => item.symbol === selectedAsset && item.timeframe === getAnalysisTimeframe(selectedTimeframe));
  const selectedStaleWarning = systemHealth?.stale_data_warnings?.find((item) => item.symbol === selectedAsset && item.timeframe === getAnalysisTimeframe(selectedTimeframe));

  const handleDataCollected = () => {
    refreshDashboard();
    refreshCandles();
  };

  useEffect(() => {
    let active = true;
    const loadHealth = async () => {
      try {
        const response = await api.get("/system/health");
        if (active) setSystemHealth(response.data);
      } catch (requestError) {
        if (active) setSystemHealth({ application_status: "degraded", error: requestError.response?.data?.error || requestError.message });
      }
    };
    loadHealth();
    const timer = window.setInterval(loadHealth, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

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
          <span>Data: MT5 Broker</span>
          <span>Health: {systemHealth?.application_status || "checking"}</span>
          <span title={selectedStaleWarning?.status || ""}>Fresh: {formatTime(selectedFreshness?.latest_candle_time)}</span>
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
          candleMetadata={candleMetadata}
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

        {!focusMode && analysisVisible && <AnalysisPanel asset={selectedAssetData} latestPrice={latestPrice} liveQuote={selectedLiveQuote} selectedTimeframe={getAnalysisTimeframe(selectedTimeframe)} candleMetadata={candleMetadata} systemHealth={systemHealth} onJournalCreated={() => setJournalRefreshToken((value) => value + 1)} />}
        {!focusMode && <LowerTabs selectedSymbol={selectedAsset} collapsed={!historyVisible} onToggleCollapsed={() => setHistoryVisible((value) => !value)} journalRefreshToken={journalRefreshToken} systemHealth={systemHealth} />}
      </main>
    </div>
  );
}

export default App;
