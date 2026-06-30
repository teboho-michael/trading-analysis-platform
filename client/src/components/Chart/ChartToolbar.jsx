export default function ChartToolbar({
  chartMode,
  onChartModeChange,
  selectedTimeframe,
  onTimeframeChange,
}) {
  return (
    <div className="chart-controls" aria-label="Chart controls">
      <label>
        <span>Chart mode</span>
        <select aria-label="Chart mode" value={chartMode} onChange={(event) => onChartModeChange(event.target.value)}>
          <option value="tradingview">TradingView</option>
          <option value="internal">Internal</option>
        </select>
      </label>
      <label>
        <span>Timeframe</span>
        <select aria-label="Chart timeframe" value={selectedTimeframe} onChange={(event) => onTimeframeChange(event.target.value)}>
          <option value="M1">M1</option>
          <option value="M5">M5</option>
          <option value="M15">M15</option>
          <option value="H1">H1</option>
          <option value="H4">H4</option>
          <option value="D1">D1</option>
        </select>
      </label>
    </div>
  );
}
