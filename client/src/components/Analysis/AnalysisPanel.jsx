import { getInstrument } from "../../config/instruments";

const formatValue = (value, maximumFractionDigits = 5) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, { maximumFractionDigits })
    : "—";
};

const classToken = (value) => String(value || "wait").toLowerCase().replaceAll(" ", "-");

function AnalysisRow({ label, value, valueClass = "" }) {
  return <div className="analysis-row"><span>{label}</span><strong className={valueClass}>{value ?? "—"}</strong></div>;
}

const getDirection = (asset) => {
  const signal = String(asset.latestSignal?.signal_type || asset.signal || "WAIT").toUpperCase();
  if (signal.includes("BUY")) return "BUY";
  if (signal.includes("SELL")) return "SELL";
  return "WAIT";
};

const getSetupStatus = (stage, direction, hasZone) => {
  if (stage === "INVALIDATED") return "Invalidated";
  if (stage === "READY" || direction !== "WAIT") return "Active";
  if (hasZone || stage === "WATCH") return "Waiting";
  return "No setup";
};

const getZoneStatus = (zone) => {
  if (!zone) return "Unavailable";
  if (zone.broken_at || zone.status === "broken") return "Broken";
  if (zone.mitigated_at || zone.status === "mitigated") return "Mitigated";
  if (zone.touched_at) return "Touched";
  return zone.status || "Active";
};

export default function AnalysisPanel({ asset, latestPrice, liveQuote }) {
  if (!asset) return <aside className="analysis-panel panel-shell"><p className="analysis-empty">Selected instrument analysis is unavailable.</p></aside>;

  const instrument = getInstrument(asset.symbol);
  const metadata = asset.instrument || {};
  const activeZone = asset.activeZone || null;
  const direction = getDirection(asset);
  const stage = String(asset.setupStage || "WAIT").toUpperCase();
  const setupStatus = getSetupStatus(stage, direction, Boolean(activeZone));
  const nextAction = asset.nextAction || asset.signalReason || "No valid setup yet.";
  const levels = asset.latestSignal ? {
    entry: asset.latestSignal.entry_price,
    stopLoss: asset.latestSignal.stop_loss,
    takeProfit1: asset.latestSignal.take_profit_1,
    takeProfit2: asset.latestSignal.take_profit_2,
  } : asset.risk ? {
    entry: asset.risk.entryPrice,
    stopLoss: asset.risk.stopLoss,
    takeProfit1: asset.risk.takeProfit1,
    takeProfit2: asset.risk.takeProfit2,
  } : null;
  const checklist = asset.confirmationChecklist || [];
  const emaConfirmation = checklist.find((item) => item.key === "h1Ema");
  const zoneAlignment = checklist.find((item) => item.key === "activeZone");
  const proximity = checklist.find((item) => item.key === "proximity");

  return (
    <aside className="analysis-panel panel-shell decision-panel" aria-label="Trading decision analysis">
      <header className="decision-market">
        <div><span className="eyebrow">Selected market</span><h2>{asset.symbol}</h2><small>{instrument.name}</small></div>
        <div className="decision-market-price"><span>Latest price</span><strong>{formatValue(liveQuote?.price ?? latestPrice)}</strong></div>
      </header>

      <section className={`decision-card setup-card direction-${classToken(direction)}`}>
        <div className="decision-card-heading"><h3>Current Setup</h3><span className={`direction-badge direction-${classToken(direction)}`}>{direction}</span></div>
        <div className="setup-summary">
          <span><small>Stage</small><strong className={`stage-${classToken(stage)}`}>{stage}</strong></span>
          <span><small>Quality</small><strong>{asset.qualityScore ?? 0}/100</strong></span>
          <span><small>Status</small><strong>{setupStatus}</strong></span>
        </div>
        <div className="next-action"><small>Next action</small><strong>{nextAction}</strong></div>
        {asset.invalidationReason && <p className="decision-warning">{asset.invalidationReason}</p>}
      </section>

      <section className="decision-card levels-card">
        <h3>Trade Levels</h3>
        <div className="level-grid">
          <AnalysisRow label="Zone High" value={formatValue(activeZone?.zone_high)} valueClass="zone-level" />
          <AnalysisRow label="Zone Low" value={formatValue(activeZone?.zone_low)} valueClass="zone-level" />
          <AnalysisRow label="Entry" value={formatValue(levels?.entry)} valueClass={levels ? "entry-level" : ""} />
          <AnalysisRow label="Stop Loss" value={formatValue(levels?.stopLoss)} valueClass="stop-level" />
          <AnalysisRow label="TP1" value={formatValue(levels?.takeProfit1)} valueClass="target-level" />
          <AnalysisRow label="TP2" value={formatValue(levels?.takeProfit2)} valueClass="target-level" />
        </div>
        {!levels && <p className="decision-empty">No valid entry yet.</p>}
        {asset.risk && <p className="level-note">Risk {asset.risk.riskPercent}% · {formatValue(asset.risk.positionSizeUnits, 6)} units</p>}
      </section>

      <section className="decision-card bias-card">
        <h3>Bias Confirmation</h3>
        <div className="bias-strip">
          <span>D1 <strong>{asset.dailyBias || "—"}</strong></span>
          <span>H4 <strong>{asset.h4Bias || "—"}</strong></span>
          <span>H1 <strong>{asset.h1Trend || "—"}</strong></span>
        </div>
        <div className="decision-checklist">
          {[...checklist.filter((item) => ["d1Bias", "h4Bias"].includes(item.key)), emaConfirmation, zoneAlignment, proximity]
            .filter((item, index, items) => item && items.findIndex((candidate) => candidate.key === item.key) === index)
            .map((item) => <p className={item.passed ? "passed" : "missing"} key={item.key}><span>{item.passed ? "✓" : "✕"}</span>{item.label}</p>)}
        </div>
        {checklist.length === 0 && <p className="decision-empty">Confirmation checklist unavailable.</p>}
      </section>

      <section className="decision-card zone-card">
        <h3>Active Zone</h3>
        {activeZone ? <>
          <AnalysisRow label="Type" value={activeZone.zone_type} valueClass={classToken(activeZone.zone_type)} />
          <AnalysisRow label="Timeframe" value={activeZone.timeframe || "H4"} />
          <AnalysisRow label="Zone High" value={formatValue(activeZone.zone_high)} />
          <AnalysisRow label="Zone Low" value={formatValue(activeZone.zone_low)} />
          <AnalysisRow label="Distance" value={asset.zoneProximity?.distancePercent !== null && asset.zoneProximity?.distancePercent !== undefined ? `${asset.zoneProximity.distancePercent}%` : "—"} />
          <AnalysisRow label="Status" value={getZoneStatus(activeZone)} />
          <AnalysisRow label="Strength" value={activeZone.strength ? `${activeZone.strength}/5` : "—"} />
        </> : <p className="decision-empty">No active zone available.</p>}
      </section>

      <section className="decision-card data-truth-card">
        <h3>Data Truth</h3>
        <AnalysisRow label="Chart mode" value="TradingView" />
        <AnalysisRow label="Analysis provider" value={metadata.dataSourceLabel || "Twelve Data"} />
        <AnalysisRow label="Broker mapping" value="Pending MT5/VPS" />
        {metadata.isProxy && <p className="proxy-line">{metadata.proxySymbol} proxy is used for analysis.</p>}
      </section>
    </aside>
  );
}
