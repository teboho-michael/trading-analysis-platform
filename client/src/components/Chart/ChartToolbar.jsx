export default function ChartToolbar({
  selectedTimeframe,
  onTimeframeChange,
}) {
  return (
    <div className="chart-controls" aria-label="Chart controls">
      <label>
        <span>Timeframe</span>
        <select aria-label="Chart timeframe" value={selectedTimeframe} onChange={(event) => onTimeframeChange(event.target.value)}>
          {CHART_TIMEFRAMES.map((timeframe) => <option value={timeframe} key={timeframe}>{timeframe}</option>)}
        </select>
      </label>
    </div>
  );
}
import { CHART_TIMEFRAMES } from "../../config/timeframes";
