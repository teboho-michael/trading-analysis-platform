import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

const date = (value) => value ? new Date(value).toLocaleString() : "—";
const number = (value) => value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
const today = new Date().toISOString().slice(0, 10);
const prior = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function BacktestingResearch({ selectedSymbol }) {
  const [strategies, setStrategies] = useState([]), [runs, setRuns] = useState([]), [selectedRun, setSelectedRun] = useState(null), [results, setResults] = useState([]);
  const [readiness, setReadiness] = useState(null), [intelligence, setIntelligence] = useState(null);
  const [conditionResearch, setConditionResearch] = useState(null), [experiments, setExperiments] = useState([]), [selectedExperiment, setSelectedExperiment] = useState(null), [experimentResults, setExperimentResults] = useState([]);
  const [experimentType, setExperimentType] = useState("condition_analysis");
  const [form, setForm] = useState({ strategy_version_id: "", symbol: selectedSymbol || "BTCUSD", timeframe: "H1", date_from: prior, date_to: today });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const requestParams = () => ({ strategy_version_id: Number(form.strategy_version_id), symbol: form.symbol, date_from: form.date_from, date_to: form.date_to });
  const load = useCallback(async () => {
    try {
      const [strategyResponse, runResponse, experimentResponse] = await Promise.all([api.get("/strategies"), api.get("/backtests"), api.get("/research/experiments")]);
      const nextStrategies = strategyResponse.data.strategies || [], nextRuns = runResponse.data.backtests || [];
      setStrategies(nextStrategies); setRuns(nextRuns); setExperiments(experimentResponse.data.experiments || []);
      setForm((current) => ({ ...current, strategy_version_id: current.strategy_version_id || String(nextStrategies.find((item) => item.is_active)?.id || nextStrategies[0]?.id || "") }));
      setError("");
    } catch (requestError) { setError(requestError.response?.data?.error || "Research data is unavailable. Apply migration 009 and retry."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selectedSymbol) setForm((current) => ({ ...current, symbol: selectedSymbol })); }, [selectedSymbol]);
  const selectRun = async (run) => {
    setSelectedRun(run); setResults([]);
    try { const response = await api.get(`/backtests/${run.id}/results`); setSelectedRun(response.data.backtest); setResults(response.data.results || []); setError(""); }
    catch (requestError) { setError(requestError.response?.data?.error || "Backtest results are unavailable."); }
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await api.post("/backtests/run", { ...form, strategy_version_id: Number(form.strategy_version_id) }); await load(); await selectRun(response.data.backtest); }
    catch (requestError) { setError(requestError.response?.data?.error || "Backtest could not be run."); if (requestError.response?.data?.backtest_run_id) await load(); }
    finally { setBusy(false); }
  };
  const checkReadiness = async () => {
    setBusy(true); setError("");
    try { const response = await api.get("/backtests/readiness", { params: requestParams() }); setReadiness(response.data.readiness); }
    catch (requestError) { setError(requestError.response?.data?.error || "Readiness could not be checked."); }
    finally { setBusy(false); }
  };
  const collectRequired = async () => {
    setBusy(true); setError("");
    try { const response = await api.post("/backtests/collect-required", requestParams()); setReadiness(response.data.readiness); const limitations = (response.data.collection_statuses || []).filter((item) => ["rate_limited", "plan_limited", "failed"].includes(item.status)); if (limitations.length) setError(limitations.map((item) => `${item.timeframe}: ${item.message}`).join(" · ")); }
    catch (requestError) { setError(requestError.response?.data?.error || "Required data could not be collected."); }
    finally { setBusy(false); }
  };
  const loadIntelligence = useCallback(async () => {
    if (!form.strategy_version_id) return;
    try { const response = await api.get("/research/intelligence", { params: { strategy_version_id: Number(form.strategy_version_id), symbol: form.symbol } }); setIntelligence(response.data.intelligence); }
    catch (requestError) { setError(requestError.response?.data?.error || "Research intelligence is unavailable."); }
  }, [form.strategy_version_id, form.symbol]);
  const loadConditionResearch = useCallback(async () => {
    try { const response = await api.get("/research/conditions", { params: { symbol: form.symbol, timeframe: form.timeframe, date_from: form.date_from, date_to: form.date_to } }); setConditionResearch(response.data.research); }
    catch (requestError) { setConditionResearch(null); setError(requestError.response?.data?.error || "Pattern research is unavailable."); }
  }, [form.symbol, form.timeframe, form.date_from, form.date_to]);
  useEffect(() => { setReadiness(null); loadIntelligence(); loadConditionResearch(); }, [form.strategy_version_id, form.symbol, form.date_from, form.date_to, loadIntelligence, loadConditionResearch]);
  const selectExperiment = async (experiment) => {
    setSelectedExperiment(experiment); setExperimentResults([]);
    try { const response = await api.get(`/research/experiments/${experiment.id}/results`); setSelectedExperiment(response.data.experiment); setExperimentResults(response.data.results || []); setError(""); }
    catch (requestError) { setError(requestError.response?.data?.error || "Experiment results are unavailable."); }
  };
  const runExperiment = async () => {
    setBusy(true); setError("");
    try { const response = await api.post("/research/experiments/run", { experiment_type: experimentType, symbol: form.symbol, timeframe: form.timeframe, date_from: form.date_from, date_to: form.date_to, base_strategy_version_id: Number(form.strategy_version_id) || null, parameters: {} }); await load(); setSelectedExperiment(response.data.experiment); setExperimentResults(response.data.results || []); }
    catch (requestError) { setError(requestError.response?.data?.error || "Research experiment could not be run."); }
    finally { setBusy(false); }
  };
  const strategyLabel = (run) => run ? `${run.strategy_name || "Strategy"} ${run.strategy_version || ""}` : "—";
  const summary = selectedRun?.result_summary_json || {};
  return <div className="research-workspace">
    <form className="research-form" onSubmit={submit}>
      <label>Strategy<select value={form.strategy_version_id} onChange={(event) => setForm({ ...form, strategy_version_id: event.target.value })} required><option value="">Select strategy</option>{strategies.map((item) => <option key={item.id} value={item.id}>{item.strategy_name} · {item.version}</option>)}</select></label>
      <label>Symbol<select value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })}>{["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"].map((symbol) => <option key={symbol}>{symbol}</option>)}</select></label>
      <label>Timeframe<select value={form.timeframe} onChange={(event) => setForm({ ...form, timeframe: event.target.value })}><option>H1</option></select></label>
      <label>From<input type="date" value={form.date_from} onChange={(event) => setForm({ ...form, date_from: event.target.value })} required /></label>
      <label>To<input type="date" value={form.date_to} onChange={(event) => setForm({ ...form, date_to: event.target.value })} required /></label>
      <div className="research-actions"><button type="button" disabled={busy || !form.strategy_version_id} onClick={checkReadiness}>Check Readiness</button><button type="button" disabled={busy || !form.strategy_version_id} onClick={collectRequired}>Collect Required Data</button><button disabled={busy || !form.strategy_version_id || readiness?.ready === false}>{busy ? "Working…" : "Run Backtest"}</button></div>
    </form>
    {error && <p className="journal-message error">{error}</p>}
    <section className="research-readiness"><div className="journal-section-heading"><h3>Strategy Data Readiness</h3><small>{readiness?.ready ? "Required historical data is ready for this backtest." : readiness ? `Missing: ${readiness.missing_timeframes.join(", ") || "none"}` : "Check stored D1/H4/H1 data"}</small></div>
      {readiness ? <div className="readiness-grid">{readiness.required_timeframes.map((item) => <span key={item.timeframe} className={item.ready ? "ready" : "missing"}><strong>{item.timeframe} · {item.ready ? "ready" : "missing"}</strong><small>{item.role.replaceAll("_", " ")}</small><small>{item.available} / {item.required} candles</small><small>{date(item.earliest)} → {date(item.latest)}</small></span>)}</div> : <p className="journal-message">Readiness uses real stored candle counts only.</p>}
    </section>
    <section><div className="journal-section-heading"><h3>Research Intelligence</h3><small>{intelligence?.evidence_status || "insufficient_data"}</small></div>
      {intelligence?.symbols?.length ? intelligence.symbols.map((item) => <div className="research-intelligence" key={item.symbol}><span>Symbol<strong>{item.symbol}</strong></span><span>Status<strong>{item.status}</strong></span><span>Completed setups<strong>{item.completed_setups}</strong></span><span>Win rate<strong>{item.win_rate === null ? "—" : `${number(item.win_rate)}%`}</strong></span><span>Average R<strong>{number(item.average_r)}</strong></span><span>Total R<strong>{number(item.total_r)}</strong></span><span className="wide">Recommendation<strong>{item.recommendation}</strong></span><span className="wide">Reason<strong>{item.reason}</strong></span></div>) : <p className="journal-message">Insufficient completed backtest evidence.</p>}
    </section>
    <section><div className="journal-section-heading"><h3>Pattern Discovery</h3><small>Deterministic research classification only</small></div>
      {conditionResearch?.status === "available" ? <div className="research-intelligence pattern-discovery"><span>Market condition<strong>{conditionResearch.market_condition.condition}</strong></span><span>Confidence<strong>{conditionResearch.market_condition.confidence || "—"}</strong></span><span>Behavior<strong>{conditionResearch.trend_vs_mean_reversion.dominant_behavior}</strong></span><span>Pattern<strong>{conditionResearch.pattern_labels?.[0]?.pattern_label || "—"}</strong></span><span>Candles<strong>{conditionResearch.candle_evidence.available} / {conditionResearch.candle_evidence.required}</strong></span><span>Research only<strong>Not a trade instruction</strong></span><span className="wide">Reason<strong>{conditionResearch.market_condition.reason}</strong></span><span className="wide">Suggestion<strong>{conditionResearch.trend_vs_mean_reversion.recommendation}</strong></span></div> : <p className="journal-message">Insufficient stored data for condition and pattern classification.</p>}
    </section>
    <section className="research-lab"><div className="journal-section-heading"><h3>Research Lab</h3><small>Stored data and saved backtests only</small></div>
      <div className="research-lab-controls"><label>Experiment type<select value={experimentType} onChange={(event) => setExperimentType(event.target.value)}><option value="condition_analysis">Market Condition Analysis</option><option value="feature_analysis">Feature Analysis</option><option value="strategy_comparison">Strategy Comparison</option><option value="parameter_comparison">Parameter Comparison Foundation</option><option value="timeframe_readiness">Timeframe Readiness</option></select></label><button type="button" disabled={busy} onClick={runExperiment}>{busy ? "Working…" : "Run Experiment"}</button></div>
      <div className="research-columns"><div><div className="journal-section-heading"><h3>Latest Experiments</h3><small>{experiments.length} saved</small></div>{experiments.length ? <div className="journal-table-wrap research-experiments"><table><thead><tr><th>Created</th><th>Type</th><th>Status</th><th>Name</th></tr></thead><tbody>{experiments.map((experiment) => <tr key={experiment.id} className={selectedExperiment?.id === experiment.id ? "selected-row" : ""} onClick={() => selectExperiment(experiment)}><td>{date(experiment.created_at)}</td><td>{experiment.experiment_type.replaceAll("_", " ")}</td><td>{experiment.status}</td><td>{experiment.experiment_name}</td></tr>)}</tbody></table></div> : <p className="journal-message">No research experiments yet.</p>}</div>
        <div><div className="journal-section-heading"><h3>Selected Experiment</h3><small>{selectedExperiment?.status || "none"}</small></div>{selectedExperiment ? <div className="research-summary"><span>Type<strong>{selectedExperiment.experiment_type.replaceAll("_", " ")}</strong></span><span>Status<strong>{selectedExperiment.status}</strong></span><span>Results<strong>{experimentResults.length}</strong></span><span>Completed<strong>{date(selectedExperiment.completed_at)}</strong></span><span className="wide">Summary<strong>{selectedExperiment.status === "insufficient_data" ? "Insufficient stored data for this experiment." : JSON.stringify(selectedExperiment.result_summary_json || {})}</strong></span></div> : <p className="journal-message">Select an experiment to inspect its real saved metrics.</p>}</div></div>
      {experimentResults.length ? <div className="journal-table-wrap research-experiment-results"><table><thead><tr><th>Metric</th><th>Value</th><th>Symbol</th><th>Timeframe</th></tr></thead><tbody>{experimentResults.map((result) => <tr key={result.id}><td>{result.metric_name.replaceAll("_", " ")}</td><td>{number(result.metric_value)}</td><td>{result.symbol}</td><td>{result.timeframe}</td></tr>)}</tbody></table></div> : selectedExperiment?.status === "insufficient_data" ? <p className="journal-message">Insufficient stored data for this experiment.</p> : null}
    </section>
    <div className="research-columns">
      <section><div className="journal-section-heading"><h3>Latest Runs</h3><small>{runs.length} saved</small></div>
        {runs.length ? <div className="journal-table-wrap research-runs"><table><thead><tr><th>Created</th><th>Strategy</th><th>Symbol</th><th>Range</th><th>Status</th><th>Setups</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className={selectedRun?.id === run.id ? "selected-row" : ""} onClick={() => selectRun(run)}><td>{date(run.created_at)}</td><td>{strategyLabel(run)}</td><td>{run.symbol} {run.timeframe}</td><td>{String(run.date_from).slice(0, 10)} → {String(run.date_to).slice(0, 10)}</td><td>{run.status}</td><td>{run.setups_found}</td></tr>)}</tbody></table></div> : <p className="journal-message">No backtests yet. Results appear only after a stored-candle run.</p>}
      </section>
      <section><div className="journal-section-heading"><h3>Selected Summary</h3><small>{strategyLabel(selectedRun)}</small></div>
        {selectedRun ? <div className="research-summary"><span>Symbol<strong>{selectedRun.symbol} {selectedRun.timeframe}</strong></span><span>Candles<strong>{selectedRun.candles_evaluated}</strong></span><span>Setups<strong>{selectedRun.setups_found}</strong></span><span>Completed<strong>{selectedRun.completed_setups}</strong></span><span>Win rate<strong>{selectedRun.win_rate === null ? "—" : `${number(selectedRun.win_rate)}%`}</strong></span><span>Average R<strong>{number(selectedRun.average_r)}</strong></span><span>Total R<strong>{number(selectedRun.total_r)}</strong></span><span>Review<strong>{summary.requires_review_count || 0}</strong></span>{selectedRun.error_message && <span className="wide">Status detail<strong>{selectedRun.error_message}</strong></span>}</div> : <p className="journal-message">Select a saved run to inspect its evidence.</p>}
      </section>
    </div>
    <div className="journal-section-heading"><h3>Backtest Results</h3><small>{results.length} setups</small></div>
    {results.length ? <div className="journal-table-wrap research-results"><table><thead><tr><th>Setup time</th><th>Direction</th><th>Quality</th><th>Entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>Outcome</th><th>Final R</th><th>Review reason</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}><td>{date(result.setup_time)}</td><td>{result.direction}</td><td>{number(result.quality_score)}</td><td>{number(result.entry)}</td><td>{number(result.stop_loss)}</td><td>{number(result.tp1)}</td><td>{number(result.tp2)}</td><td>{result.outcome}</td><td>{number(result.final_r)}</td><td>{result.review_reason || "—"}</td></tr>)}</tbody></table></div> : <p className="journal-message">{selectedRun?.status === "failed" ? selectedRun.error_message : "No setup results for the selected run."}</p>}
  </div>;
}
