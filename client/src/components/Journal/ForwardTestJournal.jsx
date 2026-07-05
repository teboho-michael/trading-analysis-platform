import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

const EMPTY_STATS = { total_entries: 0, setup_entries: 0, watch_entries: 0, observation_entries: 0, provider_limited_entries: 0, completed_setups: 0, tp1_count: 0, tp2_count: 0, stopped_out_count: 0, average_final_r: null, win_rate_approximation: null };
const FILTERS = [["all", "All"], ["setup", "Setups"], ["watch", "Watch"], ["observation", "Observations"], ["provider_limited", "Provider Limited"]];
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const number = (value) => value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function ForwardTestJournal({ selectedSymbol, refreshToken }) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSymbol) params.set("symbol", selectedSymbol);
      if (filter !== "all") params.set("entry_type", filter);
      const query = params.size ? `?${params}` : "";
      const [entriesResponse, statsResponse] = await Promise.all([api.get(`/journal${query}`), api.get(`/journal/stats${query}`)]);
      setEntries(entriesResponse.data.entries || []);
      setStats(statsResponse.data.stats || EMPTY_STATS);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Journal is unavailable. Apply migration 006 and retry.");
    }
  }, [selectedSymbol, filter]);

  useEffect(() => { load(); }, [load, refreshToken]);

  const update = async (entry, outcome) => {
    setBusyId(entry.id);
    try {
      const completed = ["tp1_hit", "tp2_hit", "stopped_out", "invalidated"].includes(outcome);
      await api.patch(`/journal/${entry.id}/outcome`, { outcome, status: outcome, closed_at: completed ? new Date().toISOString() : null });
      await load();
    } catch (requestError) { setError(requestError.response?.data?.error || "Could not update journal entry."); }
    finally { setBusyId(null); }
  };

  const addReview = async (entry) => {
    const note = window.prompt("Journal review note", entry.reviewer_notes || "");
    if (note === null) return;
    setBusyId(entry.id);
    try { await api.patch(`/journal/${entry.id}/outcome`, { reviewer_notes: note, review_status: "reviewed" }); await load(); }
    catch (requestError) { setError(requestError.response?.data?.error || "Could not save review."); }
    finally { setBusyId(null); }
  };

  const viewDetails = (entry) => window.alert([
    `${entry.symbol} ${entry.direction} · ${entry.strategy_name} ${entry.strategy_version}`,
    `Stage: ${entry.setup_stage} · Quality: ${number(entry.quality_score)}`,
    `Bias: D1 ${entry.d1_bias || "—"} · H4 ${entry.h4_bias || "—"} · H1 ${entry.h1_trend || "—"}`,
    `Zone: ${entry.zone_type || "—"} ${entry.zone_timeframe || "—"} · ${number(entry.zone_low)}–${number(entry.zone_high)}`,
    `Source: ${entry.data_source} · ${entry.provider_symbol} · ${entry.price_scale_mode}`,
    `Review: ${entry.reviewer_notes || "No review note"}`,
    `Notes: ${entry.notes || "No observation note"}`,
  ].join("\n"));

  const setupActions = (entry) => <><button disabled={busyId === entry.id} onClick={() => update(entry, "tp1_hit")}>TP1</button><button disabled={busyId === entry.id} onClick={() => update(entry, "tp2_hit")}>TP2</button><button disabled={busyId === entry.id} onClick={() => update(entry, "stopped_out")}>Stopped</button><button disabled={busyId === entry.id} onClick={() => update(entry, "manually_closed")}>Closed</button></>;
  const observationActions = (entry) => <><button disabled={busyId === entry.id} onClick={() => update(entry, "converted_to_setup")}>Converted</button><button disabled={busyId === entry.id} onClick={() => update(entry, "expired")}>Expired</button><button disabled={busyId === entry.id} onClick={() => update(entry, "reviewed")}>Reviewed</button><button disabled={busyId === entry.id} onClick={() => update(entry, "ignored")}>Ignored</button></>;

  return <div className="journal-workspace">
    <div className="journal-stats">
      <span>Total entries<strong>{stats.total_entries}</strong></span><span>Setups<strong>{stats.setup_entries}</strong></span><span>Watch<strong>{stats.watch_entries}</strong></span><span>Observations<strong>{stats.observation_entries}</strong></span><span>Provider limited<strong>{stats.provider_limited_entries}</strong></span><span>Completed setups<strong>{stats.completed_setups}</strong></span>
      <span>TP1 hit<strong>{stats.tp1_count}</strong></span><span>TP2 hit<strong>{stats.tp2_count}</strong></span>
      <span>Stopped out<strong>{stats.stopped_out_count}</strong></span><span>Avg R<strong>{number(stats.average_final_r)}</strong></span>
      <span>Win rate<strong>{stats.win_rate_approximation === null ? "—" : `${stats.win_rate_approximation}%`}</strong></span>
    </div>
    <nav className="journal-filters" aria-label="Journal entry filters">{FILTERS.map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</nav>
    {error && <p className="journal-message error">{error}</p>}
    {!error && entries.length === 0 && <p className="journal-message">No matching journal entries yet.</p>}
    {entries.length > 0 && <div className="journal-table-wrap"><table><thead><tr><th>Created</th><th>Type</th><th>Symbol</th><th>Direction</th><th>Stage</th><th>Quality</th><th>Entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>Status</th><th>Outcome</th><th>Final R</th><th>Review / actions</th></tr></thead>
      <tbody>{entries.map((entry) => <tr key={entry.id}><td>{date(entry.created_at)}</td><td>{entry.entry_type}</td><td>{entry.symbol}</td><td>{entry.direction || "—"}</td><td>{entry.setup_stage}</td><td>{number(entry.quality_score)}</td><td>{number(entry.entry)}</td><td>{number(entry.stop_loss)}</td><td>{number(entry.tp1)}</td><td>{number(entry.tp2)}</td><td>{entry.status}</td><td>{entry.outcome}</td><td>{number(entry.final_r_result)}</td><td><div className="journal-actions"><button onClick={() => viewDetails(entry)}>View</button>{entry.entry_type === "setup" ? setupActions(entry) : observationActions(entry)}<button disabled={busyId === entry.id} onClick={() => update(entry, "invalidated")}>Invalid</button><button disabled={busyId === entry.id} onClick={() => addReview(entry)} title={entry.reviewer_notes || "Add review note"}>Note</button></div></td></tr>)}</tbody></table></div>}
  </div>;
}
