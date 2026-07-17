import { getInstrument } from "../../config/instruments";
import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const formatValue = (value, maximumFractionDigits = 5) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, { maximumFractionDigits })
    : "—";
};

const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "—";

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

const getAlignmentMessage = (metadata) => {
  if (metadata.sourceMode !== "mt5_broker") return "Source metadata is unavailable for the selected market.";
  return "Chart, analysis, and research are aligned to stored XM MT5 broker candles.";
};

function AnalysisPanelContent({ asset, latestPrice, liveQuote, selectedTimeframe = "H1", candleMetadata, systemHealth, onJournalCreated }) {
  const [journalState, setJournalState] = useState({ busy: false, message: "", error: false, entry: null });
  const [paperState, setPaperState] = useState({ busy: false, message: "", error: false, entry: null });

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
  const canJournal = Boolean(levels?.entry && levels?.stopLoss && levels?.takeProfit1 && ["BUY", "SELL"].includes(direction));
  const canPaperActivate = canJournal && liveQuote?.status === "live" && liveQuote?.is_fresh === true;
  const insufficientData = [asset.dailyBias, asset.h4Bias, asset.h1Trend].some((value) => String(value).toLowerCase().includes("insufficient"));
  const providerLimited = !canJournal && insufficientData && metadata.sourceMode !== "mt5_broker";
  const entryType = canJournal ? "setup" : providerLimited ? "provider_limited" : (stage === "WATCH" || activeZone) ? "watch" : "observation";
  const analysisTimeframe = ["M1", "M5", "M15"].includes(selectedTimeframe) ? "H1" : selectedTimeframe;
  const dedupeKey = useMemo(() => `${asset.symbol}:${entryType}:${stage}:${asset.qualityScore ?? 0}:${asset.dailyBias || "none"}:${asset.h4Bias || "none"}:${asset.h1Trend || "none"}:${new Date().toISOString().slice(0, 10)}`, [asset.symbol, asset.qualityScore, asset.dailyBias, asset.h4Bias, asset.h1Trend, entryType, stage]);
  const actionLabel = entryType === "setup" ? "Add Setup to Journal" : entryType === "provider_limited" ? "Track Provider Limitation" : entryType === "watch" ? "Track Watch" : "Track Observation";
  const failureMessage = entryType === "setup" ? "Could not add setup to journal" : entryType === "watch" ? "Could not track watch entry" : "Could not track observation";
  const successMessage = entryType === "setup" ? "Setup added to journal." : entryType === "watch" ? "Watch entry tracked." : entryType === "provider_limited" ? "Provider limitation tracked." : "Observation tracked.";
  useEffect(() => {
    let active = true;
    api.get(`/journal?symbol=${encodeURIComponent(asset.symbol)}&limit=50`).then((response) => {
      if (!active) return;
      const existing = (response.data.entries || []).find((entry) => entry.signal_id && entry.signal_id === asset.latestSignal?.id)
        || (response.data.entries || []).find((entry) => entry.dedupe_key === dedupeKey);
      setJournalState((current) => ({ ...current, entry: existing || null, message: existing ? "Already in journal." : "", error: false }));
    }).catch(() => {});
    return () => { active = false; };
  }, [asset.symbol, asset.latestSignal?.id, dedupeKey]);
  const addToJournal = async () => {
    setJournalState({ busy: true, message: "", error: false });
    try {
      const response = asset.latestSignal?.id
        && entryType === "setup" ? await api.post(`/journal/from-signal/${asset.latestSignal.id}`)
        : await api.post("/journal", {
          entry_type: entryType, symbol: asset.symbol, strategy_name: entryType === "setup" ? "core-confluence" : undefined, strategy_version: entryType === "setup" ? "v3.6" : undefined, timeframe: analysisTimeframe, direction: entryType === "setup" ? direction : undefined,
          setup_stage: stage || "WAIT", quality_score: asset.qualityScore, status: entryType === "watch" ? "watching" : "pending", outcome: entryType === "watch" ? "watching" : "pending", d1_bias: asset.dailyBias, h4_bias: asset.h4Bias,
          execution_mode: "analysis_only", lifecycle_update_count: 0, requires_review: false, review_reason: null,
          h1_trend: asset.h1Trend, ema_confirmation: Boolean(emaConfirmation?.passed), zone_type: activeZone?.zone_type, zone_timeframe: activeZone?.timeframe,
          zone_high: activeZone?.zone_high, zone_low: activeZone?.zone_low, zone_status: activeZone?.status, distance_from_zone: asset.zoneProximity?.distanceFromZone,
          entry: levels?.entry, stop_loss: levels?.stopLoss, tp1: levels?.takeProfit1, tp2: levels?.takeProfit2,
          data_source: metadata.dataSourceLabel, provider_symbol: metadata.analysisProviderSymbol || metadata.providerSymbol,
          price_scale_mode: metadata.priceScaleMode, source_mode: metadata.sourceMode, broker_symbol: metadata.brokerSymbol,
          reviewer_notes: entryType === "setup" ? undefined : "Tracked from right panel observation",
          notes: entryType === "provider_limited" ? `Analysis unavailable for ${asset.symbol}: current provider access does not supply ${metadata.analysisProviderSymbol || metadata.providerSymbol}.` : nextAction,
          dedupe_key: dedupeKey,
        });
      setJournalState({ busy: false, message: response.data.created === false ? "Already in journal." : successMessage, error: false, entry: response.data.entry });
      onJournalCreated?.();
    } catch (requestError) {
      const detail = requestError.response?.data?.error;
      setJournalState({ busy: false, message: detail ? `${failureMessage}: ${detail}` : failureMessage, error: true });
    }
  };
  const updateLifecycle = async () => {
    if (!journalState.entry?.id) return;
    setJournalState((current) => ({ ...current, busy: true, message: "" }));
    try {
      const response = await api.post(`/journal/${journalState.entry.id}/lifecycle/update`);
      setJournalState({ busy: false, message: response.data.reason || "Lifecycle updated.", error: false, entry: response.data.entry });
      onJournalCreated?.();
    } catch (requestError) { setJournalState((current) => ({ ...current, busy: false, error: true, message: requestError.response?.data?.error || "Could not update lifecycle." })); }
  };
  const activatePaperDemo = async () => {
    setPaperState({ busy: true, message: "", error: false, entry: null });
    try {
      const response = await api.post("/journal/paper/activate", { symbol: asset.symbol });
      setPaperState({
        busy: false,
        message: response.data.created === false ? "Paper demo already active." : "Paper demo activated from fresh XM tick.",
        error: false,
        entry: response.data.entry,
      });
      onJournalCreated?.();
    } catch (requestError) {
      setPaperState({ busy: false, message: requestError.response?.data?.error || "Could not activate paper demo.", error: true, entry: null });
    }
  };
  const updatePaperDemo = async () => {
    setPaperState((current) => ({ ...current, busy: true, message: "" }));
    try {
      const response = await api.post("/journal/paper/update", { symbol: asset.symbol });
      const latestPaperEntry = response.data.results?.[0]?.entry || paperState.entry;
      setPaperState({
        busy: false,
        message: `${response.data.updated} paper demo update(s), ${response.data.skipped} unchanged.`,
        error: false,
        entry: latestPaperEntry,
      });
      onJournalCreated?.();
    } catch (requestError) {
      setPaperState((current) => ({ ...current, busy: false, message: requestError.response?.data?.error || "Could not update paper demo.", error: true }));
    }
  };

  return (
    <aside className="analysis-panel panel-shell decision-panel" aria-label="Trading decision analysis">
      <header className="decision-market">
        <div><span className="eyebrow">Selected market</span><h2>{asset.symbol}</h2><small>{instrument.name}</small></div>
        <div className="decision-market-price"><span>Live XM price</span><strong>{formatValue(liveQuote?.price ?? latestPrice)}</strong><small>{liveQuote?.status || "unavailable"}</small></div>
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
        <button type="button" className="journal-add-button" disabled={journalState.busy || Boolean(journalState.entry)} onClick={addToJournal}>{journalState.busy ? "Working…" : journalState.entry ? "Already in Journal" : actionLabel}</button>
        {journalState.entry && <p className="journal-success">Lifecycle: {journalState.entry.lifecycle_status || journalState.entry.status} · {journalState.entry.outcome}</p>}
        {journalState.entry?.entry_type === "setup" && <button type="button" className="journal-add-button" disabled={journalState.busy} onClick={updateLifecycle}>Update Lifecycle</button>}
        {journalState.message && <p className={journalState.error ? "decision-warning" : "journal-success"}>{journalState.message}</p>}
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

      <section className="decision-card paper-card">
        <h3>Paper Demo Validation</h3>
        <AnalysisRow label="Mode" value="PAPER / DEMO ONLY" valueClass="paper-label" />
        <AnalysisRow label="Fresh tick" value={canPaperActivate ? "Available" : liveQuote?.status || "Unavailable"} />
        <AnalysisRow label="State" value={paperState.entry?.lifecycle_status || "Not active"} />
        <button type="button" className="journal-add-button" disabled={paperState.busy || !canPaperActivate} onClick={activatePaperDemo}>
          {paperState.busy ? "Working..." : "Activate Paper Demo"}
        </button>
        <button type="button" className="journal-add-button secondary" disabled={paperState.busy} onClick={updatePaperDemo}>Update Paper Demo</button>
        {!canPaperActivate && <p className="decision-empty">Paper activation waits for a valid BUY/SELL setup and a fresh XM MT5 tick.</p>}
        {paperState.message && <p className={paperState.error ? "decision-warning" : "journal-success"}>{paperState.message}</p>}
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
        <h3>Data / Source Alignment</h3>
        <AnalysisRow label="Platform symbol" value={asset.symbol} />
        <AnalysisRow label="XM broker symbol" value={candleMetadata?.brokerSymbol || metadata.brokerSymbol || metadata.providerSymbol || "—"} />
        <AnalysisRow label="Provider" value="XM MT5" />
        <AnalysisRow label="Active source" value={candleMetadata?.source || metadata.sourceMode || "mt5_broker"} />
        <AnalysisRow label="Timeframe" value={selectedTimeframe} />
        <AnalysisRow label="MT5 candles" value={candleMetadata?.candleCount ?? "—"} />
        <AnalysisRow label="Latest stored" value={formatDateTime(candleMetadata?.latestStoredCandleTime)} />
        <AnalysisRow label="Latest closed" value={formatDateTime(candleMetadata?.latestClosedCandleTime)} />
        <AnalysisRow label="Bridge sync" value={formatDateTime(systemHealth?.bridge_last_success)} />
        <AnalysisRow label="Candle freshness" value={candleMetadata?.freshness || "checking"} />
        <AnalysisRow label="Live tick" value={liveQuote?.status || "unavailable"} />
        <AnalysisRow label="Source purity" value={candleMetadata?.sourcePurity?.non_mt5_rows_in_response === 0 ? "MT5 only" : "mixed"} />
        <AnalysisRow label="Available frames" value="D1, H4, H1" />
        <p className={`alignment-line alignment-${classToken(metadata.priceScaleMode || "direct")}`}>{getAlignmentMessage(metadata)}</p>
      </section>
    </aside>
  );
}

export default function AnalysisPanel(props) {
  if (!props.asset) return <aside className="analysis-panel panel-shell"><p className="analysis-empty">Selected instrument analysis is unavailable.</p></aside>;
  return <AnalysisPanelContent {...props} />;
}
