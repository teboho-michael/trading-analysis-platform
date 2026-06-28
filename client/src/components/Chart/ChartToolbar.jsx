export default function ChartToolbar({
  dashboard,
  selectedAsset,
  selectedTimeframe,
  onAssetChange,
  onTimeframeChange,
}) {
  return (
    <div className="chart-controls" aria-label="Chart controls">
      <label>
        <span>Asset</span>
        <select
          aria-label="Asset"
          value={selectedAsset}
          onChange={(e) => onAssetChange(e.target.value)}
        >
          {dashboard.map((asset) => (
            <option key={asset.id} value={asset.symbol}>
              {asset.symbol}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Timeframe</span>
        <select
          aria-label="Timeframe"
          value={selectedTimeframe}
          onChange={(e) => onTimeframeChange(e.target.value)}
        >
          <option value="H1">H1</option>
          <option value="H4">H4</option>
          <option value="D1">D1</option>
        </select>
      </label>
    </div>
  );
}
