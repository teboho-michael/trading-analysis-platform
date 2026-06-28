import { useState } from "react";
import TradingChartPanel from "./components/Chart/TradingChartPanel";
import DashboardGrid from "./components/Dashboard/DashboardGrid";
import ScanMonitor from "./components/ScanMonitor/ScanMonitor";
import { useDashboard } from "./hooks/useDashboard";
import { useCandles } from "./hooks/useCandles";
import { useScanRuns } from "./hooks/useScanRuns";
import "./App.css";

function App() {
  const [selectedAsset, setSelectedAsset] = useState("US500");
  const [selectedTimeframe, setSelectedTimeframe] = useState("H1");

  const { dashboard, loading, refreshDashboard } = useDashboard();
  const { candles, refreshCandles } = useCandles(
    selectedAsset,
    selectedTimeframe
  );

  const { latestScanRun, scanRuns, refreshScanRuns } = useScanRuns();

  const selectedAssetData = dashboard.find(
    (asset) => asset.symbol === selectedAsset
  );

  const handleDataCollected = () => {
    refreshDashboard();
    refreshCandles();
    refreshScanRuns();
  };

  if (loading) {
    return (
      <div className="app">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Trading Analysis Dashboard</h1>

      <ScanMonitor latestScanRun={latestScanRun} scanRuns={scanRuns} />

      <TradingChartPanel
        dashboard={dashboard}
        candles={candles}
        selectedAsset={selectedAsset}
        selectedTimeframe={selectedTimeframe}
        selectedAssetData={selectedAssetData}
        onAssetChange={setSelectedAsset}
        onTimeframeChange={setSelectedTimeframe}
        onDataCollected={handleDataCollected}
      />

      <DashboardGrid dashboard={dashboard} />
    </div>
  );
}

export default App;