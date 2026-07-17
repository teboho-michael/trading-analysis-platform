const pool = require("../db/connection");
const { buildSetup } = require("./coreSetupService");
const { getLatestTicks } = require("./liveTickService");
const { createJournalEntry, updateJournalOutcome } = require("./setupJournalService");

const OPEN_PAPER_STATES = ["pending", "ready", "triggered", "active", "partial_target", "requires_review"];
const terminalPaperStates = new Set(["won", "lost", "tp2_hit", "stopped_out", "expired", "cancelled", "manually_closed"]);
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const normalizeSymbol = (value) => String(value || "").trim().toUpperCase();
const priceOf = (quote) => [quote?.display_price, quote?.price, quote?.mid].map(Number).find((value) => Number.isFinite(value) && value > 0) || null;
const isFreshQuote = (quote) => quote?.status === "live" && quote?.freshness === "live" && quote?.is_fresh === true && finite(priceOf(quote));
const rounded = (value) => Number(Number(value).toFixed(10));
const crossed = (previous, current, level) => finite(previous) && finite(current) && finite(level)
  && Math.min(Number(previous), Number(current)) <= Number(level)
  && Math.max(Number(previous), Number(current)) >= Number(level);

const assertValidLevels = (direction, levels) => {
  if (!["BUY", "SELL"].includes(direction)) throw validationError("Paper activation requires a BUY or SELL setup.");
  for (const field of ["entry", "stop_loss", "tp1", "tp2"]) {
    if (!finite(levels[field])) throw validationError(`Paper activation requires ${field}.`);
  }
  if (direction === "BUY" && !(Number(levels.stop_loss) < Number(levels.entry) && Number(levels.tp1) > Number(levels.entry) && Number(levels.tp2) > Number(levels.tp1))) {
    throw validationError("BUY paper setup levels are not coherent.");
  }
  if (direction === "SELL" && !(Number(levels.stop_loss) > Number(levels.entry) && Number(levels.tp1) < Number(levels.entry) && Number(levels.tp2) < Number(levels.tp1))) {
    throw validationError("SELL paper setup levels are not coherent.");
  }
};

const freshQuoteFor = async (symbol) => {
  const result = await getLatestTicks([symbol]);
  const quote = result.prices[0];
  if (!isFreshQuote(quote)) {
    throw validationError(`Fresh XM MT5 tick is required for paper lifecycle; ${symbol} is ${quote?.status || "unavailable"}.`);
  }
  return quote;
};

const activatePaperTrade = async (symbolInput) => {
  const symbol = normalizeSymbol(symbolInput);
  const setup = await buildSetup(symbol);
  if (!["BUY", "SELL"].includes(setup.signal)) {
    throw validationError(`Paper activation requires a valid BUY or SELL setup; current result is ${setup.signal}.`);
  }
  const quote = setup.live_tick && isFreshQuote(setup.live_tick) ? setup.live_tick : await freshQuoteFor(symbol);
  const livePrice = priceOf(quote);
  const levels = {
    entry: livePrice,
    stop_loss: setup.stop_loss,
    tp1: setup.tp1,
    tp2: setup.tp2,
  };
  assertValidLevels(setup.signal, levels);
  const dedupe = [
    "paper", symbol, setup.signal, setup.zone_id || "zone-none",
    rounded(levels.entry), rounded(levels.stop_loss), rounded(levels.tp1), rounded(levels.tp2),
  ].join(":");
  return createJournalEntry({
    entry_type: "setup",
    dedupe_key: dedupe,
    symbol,
    strategy_name: "core-confluence-paper-demo",
    strategy_version: "final-core",
    timeframe: "H1",
    direction: setup.signal,
    setup_stage: "PAPER_ACTIVE",
    quality_score: setup.quality_score,
    status: "triggered",
    outcome: "active",
    lifecycle_status: "active",
    d1_bias: setup.daily?.trend_state,
    h4_bias: setup.h4?.trend_state,
    h1_trend: setup.h1_confirmation?.trend_state,
    ema_confirmation: true,
    zone_type: setup.zone_type,
    zone_timeframe: "H4",
    zone_high: setup.activeZone?.zone_high,
    zone_low: setup.activeZone?.zone_low,
    zone_status: setup.activeZone?.status,
    distance_from_zone: setup.zoneProximity?.distanceFromZone,
    entry: levels.entry,
    stop_loss: levels.stop_loss,
    tp1: levels.tp1,
    tp2: levels.tp2,
    actual_entry: livePrice,
    actual_stop_loss: levels.stop_loss,
    actual_take_profit: levels.tp2,
    triggered_at: quote.received_at || new Date().toISOString(),
    paper_demo_activated_at: quote.received_at || new Date().toISOString(),
    paper_demo_last_tick_time: quote.tick_time,
    paper_demo_last_received_at: quote.received_at,
    lifecycle_last_price: livePrice,
    lifecycle_last_checked_at: quote.received_at || new Date().toISOString(),
    execution_mode: "paper_demo",
    data_source: "XM MT5",
    provider_symbol: quote.broker_symbol,
    source_mode: "mt5_broker",
    broker_symbol: quote.broker_symbol,
    notes: "PAPER DEMO VALIDATION only. No broker order was sent.",
  });
};

const evaluatePaperTradeFromTick = (entry, quote) => {
  if (!isFreshQuote(quote)) return { changed: false, reason: "Fresh XM MT5 tick is required." };
  if (terminalPaperStates.has(entry.lifecycle_status) || terminalPaperStates.has(entry.outcome)) {
    return { changed: false, reason: "Paper trade is already closed." };
  }
  const current = priceOf(quote);
  const previous = finite(entry.lifecycle_last_price) ? Number(entry.lifecycle_last_price) : Number(entry.actual_entry || entry.entry);
  const buy = entry.direction === "BUY";
  const stopHit = buy ? crossed(previous, current, entry.stop_loss) && current <= Number(entry.stop_loss) : crossed(previous, current, entry.stop_loss) && current >= Number(entry.stop_loss);
  const tp2Hit = buy ? crossed(previous, current, entry.tp2) && current >= Number(entry.tp2) : crossed(previous, current, entry.tp2) && current <= Number(entry.tp2);
  const tp1Hit = buy ? crossed(previous, current, entry.tp1) && current >= Number(entry.tp1) : crossed(previous, current, entry.tp1) && current <= Number(entry.tp1);
  const timestampFields = {
    paper_demo_last_tick_time: quote.tick_time,
    paper_demo_last_received_at: quote.received_at,
    lifecycle_last_price: current,
    lifecycle_last_checked_at: quote.received_at || new Date().toISOString(),
    actual_close_price: current,
  };
  if (stopHit) return { changed: true, status: "lost", outcome: "lost", lifecycle_status: "lost", final_r_result: -1, closed_at: quote.received_at, paper_demo_closed_at: quote.received_at, ...timestampFields };
  if (tp2Hit) return { changed: true, status: "won", outcome: "won", lifecycle_status: "won", final_r_result: finite(entry.risk_reward_tp2) ? Number(entry.risk_reward_tp2) : 3, closed_at: quote.received_at, paper_demo_closed_at: quote.received_at, ...timestampFields };
  if (tp1Hit && entry.lifecycle_status !== "partial_target") {
    return { changed: true, status: "partial_target", outcome: "partial_target", lifecycle_status: "partial_target", final_r_result: finite(entry.risk_reward_tp1) ? Number(entry.risk_reward_tp1) : 2, actual_take_profit: entry.tp1, ...timestampFields };
  }
  return { changed: false, reason: "No paper lifecycle level was reached by the fresh tick.", ...timestampFields };
};

const openPaperTrades = async (filters = {}) => {
  const values = [OPEN_PAPER_STATES];
  const clauses = ["execution_mode='paper_demo'", "lifecycle_status = ANY($1)"];
  if (filters.symbol) {
    values.push(normalizeSymbol(filters.symbol));
    clauses.push(`symbol=$${values.length}`);
  }
  const result = await pool.query(`SELECT * FROM setup_journal WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC`, values);
  return result.rows;
};

const updatePaperTrade = async (entry) => {
  const quote = await freshQuoteFor(entry.symbol);
  const evaluation = evaluatePaperTradeFromTick(entry, quote);
  const update = evaluation.changed
    ? evaluation
    : {
      lifecycle_last_price: priceOf(quote),
      lifecycle_last_checked_at: quote.received_at || new Date().toISOString(),
      paper_demo_last_tick_time: quote.tick_time,
      paper_demo_last_received_at: quote.received_at,
      actual_close_price: priceOf(quote),
    };
  const updated = await updateJournalOutcome(entry.id, update);
  return { entry: updated, updated: evaluation.changed, reason: evaluation.reason || `Paper lifecycle advanced to ${evaluation.lifecycle_status}.` };
};

const updateOpenPaperTrades = async (filters = {}) => {
  const entries = await openPaperTrades(filters);
  const results = [];
  for (const entry of entries) {
    results.push(await updatePaperTrade(entry));
  }
  return {
    updated: results.filter((item) => item.updated).length,
    skipped: results.filter((item) => !item.updated).length,
    results,
  };
};

const getPaperStats = async (filters = {}) => {
  const values = ["paper_demo"];
  const clauses = ["execution_mode=$1"];
  if (filters.symbol) {
    values.push(normalizeSymbol(filters.symbol));
    clauses.push(`symbol=$${values.length}`);
  }
  const result = await pool.query(
    `SELECT
       COUNT(*)::int total_entries,
       COUNT(*) FILTER (WHERE lifecycle_status IN ('pending','ready','triggered','active','partial_target','requires_review'))::int open_entries,
       COUNT(*) FILTER (WHERE lifecycle_status='won' OR outcome='won')::int won_count,
       COUNT(*) FILTER (WHERE lifecycle_status='lost' OR outcome='lost')::int lost_count,
       COUNT(*) FILTER (WHERE lifecycle_status='partial_target' OR outcome='partial_target')::int partial_count,
       AVG(final_r_result) FILTER (WHERE final_r_result IS NOT NULL)::numeric AS average_final_r
     FROM setup_journal
     WHERE ${clauses.join(" AND ")}`,
    values,
  );
  const stats = result.rows[0];
  const completed = stats.won_count + stats.lost_count;
  return {
    ...stats,
    average_final_r: stats.average_final_r === null ? null : Number(stats.average_final_r),
    win_rate: completed ? Number(((stats.won_count / completed) * 100).toFixed(2)) : null,
  };
};

module.exports = {
  OPEN_PAPER_STATES,
  activatePaperTrade,
  evaluatePaperTradeFromTick,
  openPaperTrades,
  updateOpenPaperTrades,
  getPaperStats,
};
