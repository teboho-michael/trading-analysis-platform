export default function ChartToolbar({
  selectedTimeframe,
  onTimeframeChange,
}) {
  return (
    <div className="chart-controls" aria-label="Chart controls">
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
