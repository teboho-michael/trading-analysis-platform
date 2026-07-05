import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

const date = (value) => value ? new Date(value).toLocaleString() : "—";
const number = (value) => value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
const today = new Date().toISOString().slice(0, 10);
const prior = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function BacktestingResearch({ selectedSymbol }) {
  const [strategies, setStrategies] = useState([]), [runs, setRuns] = useState([]), [selectedRun, setSelectedRun] = useState(null), [results, setResults] = useState([]);
  const [form, setForm] = useState({ strategy_version_id: "", symbol: selectedSymbol || "BTCUSD", timeframe: "H1", date_from: prior, date_to: today });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [strategyResponse, runResponse] = await Promise.all([api.get("/strategies"), api.get("/backtests")]);
      const nextStrategies = strategyResponse.data.strategies || [], nextRuns = runResponse.data.backtests || [];
      setStrategies(nextStrategies); setRuns(nextRuns);
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
  const strategyLabel = (run) => run ? `${run.strategy_name || "Strategy"} ${run.strategy_version || ""}` : "—";
  const summary = selectedRun?.result_summary_json || {};
  return <div className="research-workspace">
    <form className="research-form" onSubmit={submit}>
      <label>Strategy<select value={form.strategy_version_id} onChange={(event) => setForm({ ...form, strategy_version_id: event.target.value })} required><option value="">Select strategy</option>{strategies.map((item) => <option key={item.id} value={item.id}>{item.strategy_name} · {item.version}</option>)}</select></label>
      <label>Symbol<select value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })}>{["BTCUSD", "XAUUSD", "USDJPY", "US500", "US100"].map((symbol) => <option key={symbol}>{symbol}</option>)}</select></label>
      <label>Timeframe<select value={form.timeframe} onChange={(event) => setForm({ ...form, timeframe: event.target.value })}><option>H1</option></select></label>
      <label>From<input type="date" value={form.date_from} onChange={(event) => setForm({ ...form, date_from: event.target.value })} required /></label>
      <label>To<input type="date" value={form.date_to} onChange={(event) => setForm({ ...form, date_to: event.target.value })} required /></label>
      <button disabled={busy || !form.strategy_version_id}>{busy ? "Running…" : "Run Backtest"}</button>
    </form>
    {error && <p className="journal-message error">{error}</p>}
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
