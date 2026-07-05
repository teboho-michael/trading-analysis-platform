import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const FILTERS = [["all", "All"], ["setup", "Setups"], ["watch", "Watch"], ["observation", "Observations"], ["provider_limited", "Provider Limited"]];
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const number = (value) => value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
const percent = (value) => value === null || value === undefined ? "—" : `${number(value)}%`;
const completedOutcomes = new Set(["tp1_hit", "tp2_hit", "stopped_out", "invalidated", "expired", "manually_closed"]);

export function PerformanceSummary({ performance }) {
  const stats = performance?.overall || {};
  return <div className="journal-stats performance-summary">
    <span>Win rate<strong>{percent(stats.win_rate_completed_setups)}</strong></span><span>Average R<strong>{number(stats.average_final_r)}</strong></span>
    <span>Total R<strong>{number(stats.total_final_r)}</strong></span><span>Completed<strong>{stats.completed_setups ?? 0}</strong></span>
    <span>Open / active<strong>{(stats.open_setups || 0) + (stats.active_setups || 0)}</strong></span><span>TP1 / TP2<strong>{stats.tp1_count || 0} / {stats.tp2_count || 0}</strong></span>
    <span>Stopped<strong>{stats.stopped_out_count || 0}</strong></span><span>Review<strong>{stats.requires_review_count || 0}</strong></span>
  </div>;
}

const LifecycleTable = ({ entries, busyId, updateOne }) => <div className="journal-table-wrap journal-section-table"><table>
  <thead><tr><th>Symbol</th><th>Direction</th><th>Lifecycle</th><th>Outcome</th><th>Entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>Latest</th><th>Δ Entry</th><th>Δ SL</th><th>Δ TP1</th><th>Reason / checked</th><th>Action</th></tr></thead>
  <tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.symbol}</td><td>{entry.direction || "—"}</td><td>{entry.lifecycle_status || entry.status}</td><td>{entry.outcome}</td><td>{number(entry.entry)}</td><td>{number(entry.stop_loss)}</td><td>{number(entry.tp1)}</td><td>{number(entry.tp2)}</td><td>{number(entry.lifecycle_last_price)}</td><td>{number(entry.distance_to_entry)}</td><td>{number(entry.distance_to_stop_loss)}</td><td>{number(entry.distance_to_tp1)}</td><td title={entry.lifecycle_reason || ""}>{entry.lifecycle_reason || "Awaiting update"}<br/><small>{date(entry.lifecycle_last_checked_at)}</small></td><td><button disabled={busyId === entry.id} onClick={() => updateOne(entry.id)}>Update</button></td></tr>)}</tbody>
</table></div>;

export default function ForwardTestJournal({ selectedSymbol, refreshToken }) {
  const [entries, setEntries] = useState([]), [openEntries, setOpenEntries] = useState([]);
  const [performance, setPerformance] = useState({ overall: {} }), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null), [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSymbol) params.set("symbol", selectedSymbol);
      if (filter !== "all") params.set("entry_type", filter);
      const query = params.size ? `?${params}` : "", scope = selectedSymbol ? `?symbol=${encodeURIComponent(selectedSymbol)}` : "";
      const [journal, open, metrics] = await Promise.all([api.get(`/journal${query}`), api.get(`/journal/open${scope}`), api.get(`/journal/performance${scope}`)]);
      setEntries(journal.data.entries || []); setOpenEntries(open.data.entries || []); setPerformance(metrics.data || { overall: {} }); setError("");
    } catch (requestError) { setError(requestError.response?.data?.error || "Journal is unavailable. Apply migrations through 008 and retry."); }
  }, [selectedSymbol, filter]);
  useEffect(() => { load(); }, [load, refreshToken]);
  const completed = useMemo(() => entries.filter((entry) => entry.entry_type === "setup" && completedOutcomes.has(entry.outcome)), [entries]);
  const patchEntry = async (entry, update) => {
    setBusyId(entry.id); setMessage("");
    try { await api.patch(`/journal/${entry.id}/outcome`, update); await load(); } catch (requestError) { setError(requestError.response?.data?.error || "Could not update journal entry."); } finally { setBusyId(null); }
  };
  const markOutcome = (entry, outcome) => patchEntry(entry, { outcome, status: outcome, lifecycle_status: outcome, closed_at: new Date().toISOString() });
  const addNote = async (entry) => { const note = window.prompt("Journal note", entry.notes || entry.reviewer_notes || ""); if (note !== null) await patchEntry(entry, { notes: note }); };
  const markReviewed = (entry) => patchEntry(entry, { review_status: "reviewed", requires_review: false, review_reason: null });
  const updateOne = async (id) => {
    setBusyId(id); setMessage("");
    try { const response = await api.post(`/journal/${id}/lifecycle/update`); setMessage(response.data.reason || "Lifecycle update completed."); await load(); } catch (requestError) { setError(requestError.response?.data?.error || "Lifecycle update failed."); } finally { setBusyId(null); }
  };
  const updateAll = async () => {
    setBusyId("all"); setMessage("");
    try { const response = await api.post("/journal/lifecycle/update", selectedSymbol ? { symbol: selectedSymbol } : {}); setMessage(`Lifecycle: ${response.data.updated} updated, ${response.data.skipped} skipped, ${response.data.requiresReview} require review.`); await load(); } catch (requestError) { setError(requestError.response?.data?.error || "Lifecycle update failed."); } finally { setBusyId(null); }
  };
  return <div className="journal-workspace">
    <div className="journal-section-heading"><h3>Performance Summary</h3><button disabled={busyId === "all"} onClick={updateAll}>{busyId === "all" ? "Updating…" : "Update Lifecycle"}</button></div>
    <PerformanceSummary performance={performance} />{message && <p className="journal-message success">{message}</p>}{error && <p className="journal-message error">{error}</p>}
    <div className="journal-section-heading"><h3>Open Setups / Active Lifecycle</h3><small>{openEntries.length} tracked</small></div>
    {openEntries.length ? <LifecycleTable entries={openEntries} busyId={busyId} updateOne={updateOne} /> : <p className="journal-message">No open lifecycle entries.</p>}
    <div className="journal-section-heading"><h3>Completed Setups</h3><small>{completed.length} shown</small></div>
    {completed.length ? <div className="journal-table-wrap journal-section-table"><table><thead><tr><th>Symbol</th><th>Direction</th><th>Outcome</th><th>Final R</th><th>Closed</th><th>Review</th></tr></thead><tbody>{completed.map((entry) => <tr key={entry.id}><td>{entry.symbol}</td><td>{entry.direction}</td><td>{entry.outcome}</td><td>{number(entry.final_r_result)}</td><td>{date(entry.closed_at)}</td><td>{entry.requires_review ? entry.review_reason || "Required" : entry.review_status}</td></tr>)}</tbody></table></div> : <p className="journal-message">No completed setups yet.</p>}
    <div className="journal-section-heading"><h3>Journal Entries</h3></div>
    <nav className="journal-filters" aria-label="Journal entry filters">{FILTERS.map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</nav>
    {!error && entries.length === 0 && <p className="journal-message">No matching journal entries yet.</p>}
    {entries.length > 0 && <div className="journal-table-wrap"><table><thead><tr><th>Created</th><th>Type</th><th>Symbol</th><th>Direction</th><th>Stage</th><th>Quality</th><th>Entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>Lifecycle</th><th>Outcome</th><th>Final R</th><th>Review / actions</th></tr></thead><tbody>
      {entries.map((entry) => <tr key={entry.id}><td>{date(entry.created_at)}</td><td>{entry.entry_type}</td><td>{entry.symbol}</td><td>{entry.direction || "—"}</td><td>{entry.setup_stage}</td><td>{number(entry.quality_score)}</td><td>{number(entry.entry)}</td><td>{number(entry.stop_loss)}</td><td>{number(entry.tp1)}</td><td>{number(entry.tp2)}</td><td>{entry.lifecycle_status || entry.status}</td><td>{entry.outcome}</td><td>{number(entry.final_r_result)}</td><td><div className="journal-actions">{entry.entry_type === "setup" && !completedOutcomes.has(entry.outcome) && <button disabled={busyId === entry.id} onClick={() => updateOne(entry.id)}>Update</button>}<button disabled={busyId === entry.id} onClick={() => markOutcome(entry, "invalidated")}>Invalid</button>{entry.entry_type === "setup" && <button disabled={busyId === entry.id} onClick={() => markOutcome(entry, "manually_closed")}>Close</button>}<button disabled={busyId === entry.id} onClick={() => markReviewed(entry)}>Reviewed</button><button disabled={busyId === entry.id} onClick={() => addNote(entry)}>Note</button></div></td></tr>)}
    </tbody></table></div>}
  </div>;
}
