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
          {CHART_TIMEFRAMES.map((timeframe) => <option value={timeframe} key={timeframe}>{timeframe}{isVisualOnlyTimeframe(timeframe) ? " · visual only" : ""}</option>)}
        </select>
      </label>
    </div>
  );
}
import { CHART_TIMEFRAMES, isVisualOnlyTimeframe } from "../../config/timeframes";
