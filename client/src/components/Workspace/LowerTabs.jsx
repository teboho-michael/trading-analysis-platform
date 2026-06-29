import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

const TABS = ["Signals", "Zones", "Performance", "Alerts", "System"];
const date = (value) => value ? new Date(value).toLocaleString() : "—";

export default function LowerTabs({ selectedSymbol }) {
  const [tab, setTab] = useState("Signals");
  const [data, setData] = useState({ signals: [], zones: [], alerts: [], health: null, provider: null });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      const calls = await Promise.allSettled([api.get("/signals"), api.get("/zones"), api.get("/alerts/history?limit=100"), api.get("/health"), api.get("/provider/status")]);
      if (!active) return;
      const payload = (index) => calls[index].status === "fulfilled" ? calls[index].value.data : calls[index].reason.response?.data;
      setData({ signals: payload(0)?.signals || [], zones: payload(1)?.zones || [], alerts: payload(2)?.alerts || [], health: payload(3), provider: payload(4) });
      setError(calls.every((call) => call.status === "rejected") ? "System history is unavailable." : "");
    };
    load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer); };
  }, []);
  const signals = data.signals.filter((item) => !selectedSymbol || item.symbol === selectedSymbol);
  const zones = data.zones.filter((item) => !selectedSymbol || item.symbol === selectedSymbol);
  const alerts = data.alerts.filter((item) => !selectedSymbol || item.symbol === selectedSymbol);
  const performance = useMemo(() => { const closed = signals.filter((s) => s.status === "closed"); const wins = closed.filter((s) => String(s.outcome_reason).startsWith("TAKE_PROFIT")).length; return { total: signals.length, active: signals.filter((s) => s.status === "active").length, closed: closed.length, wins, winRate: closed.length ? Math.round(wins / closed.length * 100) : 0 }; }, [signals]);
  return <section className="lower-panel panel-shell">
    <nav className="lower-tabs" aria-label="Analysis history">{TABS.map((name) => <button key={name} type="button" className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <div className="lower-content">{error && <p>{error}</p>}
      {tab === "Signals" && <table><thead><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Status</th><th>Entry</th><th>Outcome</th></tr></thead><tbody>{signals.slice(0, 30).map((s) => <tr key={s.id}><td>{date(s.created_at)}</td><td>{s.symbol}</td><td>{s.signal_type}</td><td>{s.status}</td><td>{s.entry_price}</td><td>{s.outcome_reason || "—"}</td></tr>)}</tbody></table>}
      {tab === "Zones" && <table><thead><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Status</th><th>Range</th><th>Strength</th></tr></thead><tbody>{zones.slice(0, 30).map((z) => <tr key={z.id}><td>{date(z.created_at)}</td><td>{z.symbol}</td><td>{z.zone_type}</td><td>{z.status}</td><td>{z.zone_low} – {z.zone_high}</td><td>{z.strength || "—"}</td></tr>)}</tbody></table>}
      {tab === "Performance" && <div className="system-grid"><span>Total signals <strong>{performance.total}</strong></span><span>Active <strong>{performance.active}</strong></span><span>Closed <strong>{performance.closed}</strong></span><span>Wins <strong>{performance.wins}</strong></span><span>Win rate <strong>{performance.winRate}%</strong></span></div>}
      {tab === "Alerts" && <table><thead><tr><th>Time</th><th>Symbol</th><th>Severity</th><th>Event</th><th>Message</th></tr></thead><tbody>{alerts.slice(0, 50).map((a) => <tr key={a.id}><td>{date(a.created_at)}</td><td>{a.symbol}</td><td>{a.severity}</td><td>{a.alert_type}</td><td>{a.message}</td></tr>)}</tbody></table>}
      {tab === "System" && <div className="system-grid"><span>Backend <strong>{data.health?.backend || "unavailable"}</strong></span><span>Database <strong>{data.health?.database || "unavailable"}</strong></span><span>Provider <strong>{data.provider?.label || data.health?.providerLabel || "—"}</strong></span><span>Bridge <strong>{data.provider?.bridge?.status || "—"}</strong></span><span>Last scan <strong>{data.health?.lastScan?.lastStatus || "—"}</strong></span><span>Last success <strong>{date(data.health?.lastScan?.lastSuccessfulScanAt)}</strong></span>{data.health?.lastScan?.latestScanError && <span className="wide">Latest error <strong>{data.health.lastScan.latestScanError}</strong></span>}</div>}
    </div>
  </section>;
}
