const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");

const OUTCOMES = new Set(["pending", "watching", "triggered", "tp1_hit", "tp2_hit", "stopped_out", "invalidated", "expired", "manually_closed"]);
const REVIEW_STATUSES = new Set(["unreviewed", "reviewed", "ignored"]);
const COMPLETED = ["tp1_hit", "tp2_hit", "stopped_out", "invalidated", "expired", "manually_closed"];
const COLUMNS = ["signal_id", "symbol", "strategy_name", "strategy_version", "timeframe", "direction", "setup_stage", "quality_score", "status", "outcome", "d1_bias", "h4_bias", "h1_trend", "ema_confirmation", "zone_type", "zone_timeframe", "zone_high", "zone_low", "zone_status", "distance_from_zone", "entry", "stop_loss", "tp1", "tp2", "risk_reward_tp1", "risk_reward_tp2", "triggered_at", "closed_at", "max_favourable_move", "max_adverse_move", "final_r_result", "review_status", "reviewer_notes", "screenshot_url", "tags", "data_source", "provider_symbol", "tradingview_symbol", "price_scale_mode", "source_mode"];

const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const normalizeDirection = (value) => String(value || "").toUpperCase().replace(" SETUP", "");
const rr = (entry, target, stop) => finite(entry) && finite(target) && finite(stop) && Math.abs(Number(entry) - Number(stop)) > 0
  ? Number((Math.abs(Number(target) - Number(entry)) / Math.abs(Number(entry) - Number(stop))).toFixed(4)) : null;

const prepareEntry = (input) => {
  const symbol = String(input.symbol || "").toUpperCase();
  let instrument;
  try { instrument = getInstrument(symbol); } catch (_error) { throw validationError("symbol is not a supported instrument"); }
  const direction = normalizeDirection(input.direction || input.signal_type || input.signal);
  if (!input.strategy_name || !input.strategy_version || !input.timeframe) throw validationError("strategy_name, strategy_version, and timeframe are required");
  if (!["BUY", "SELL"].includes(direction)) throw validationError("direction must be BUY or SELL");
  if (![input.entry, input.stop_loss, input.tp1].every(finite)) throw validationError("entry, stop_loss, and tp1 must be valid numbers");
  const status = String(input.status || "pending").toLowerCase();
  const outcome = String(input.outcome || status).toLowerCase();
  const reviewStatus = String(input.review_status || "unreviewed").toLowerCase();
  if (!OUTCOMES.has(status) || !OUTCOMES.has(outcome)) throw validationError("invalid status or outcome");
  if (!REVIEW_STATUSES.has(reviewStatus)) throw validationError("invalid review_status");
  return {
    ...input, symbol, direction, status, outcome, review_status: reviewStatus,
    setup_stage: input.setup_stage || "READY",
    risk_reward_tp1: input.risk_reward_tp1 ?? rr(input.entry, input.tp1, input.stop_loss),
    risk_reward_tp2: input.risk_reward_tp2 ?? rr(input.entry, input.tp2, input.stop_loss),
    data_source: input.data_source || instrument.dataSourceLabel,
    provider_symbol: input.provider_symbol || instrument.activeAnalysisSymbol,
    tradingview_symbol: input.tradingview_symbol || instrument.tradingViewSymbol,
    price_scale_mode: input.price_scale_mode || instrument.priceScaleMode,
    source_mode: input.source_mode || instrument.sourceMode,
  };
};

const createJournalEntry = async (input) => {
  const entry = prepareEntry(input);
  const values = COLUMNS.map((column) => entry[column] ?? null);
  const result = await pool.query(`INSERT INTO setup_journal (${COLUMNS.join(", ")}) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`, values);
  return { entry: result.rows[0], created: true };
};

const createJournalEntryFromSignal = async (signalId) => {
  if (!Number.isInteger(Number(signalId)) || Number(signalId) <= 0) throw validationError("signalId must be a positive integer");
  const existing = await pool.query("SELECT * FROM setup_journal WHERE signal_id = $1", [signalId]);
  if (existing.rows[0]) return { entry: existing.rows[0], created: false };
  const result = await pool.query(`SELECT s.*, a.symbol, z.zone_type, z.timeframe AS zone_timeframe, z.zone_high, z.zone_low, z.status AS zone_status FROM signals s JOIN assets a ON a.id=s.asset_id LEFT JOIN zones z ON z.id=s.zone_id WHERE s.id=$1`, [signalId]);
  if (!result.rows[0]) throw Object.assign(new Error("Signal not found"), { statusCode: 404 });
  const signal = result.rows[0];
  try {
    return await createJournalEntry({ signal_id: signal.id, symbol: signal.symbol, strategy_name: "core-confluence", strategy_version: "v3.4", timeframe: signal.zone_timeframe || "H4", direction: signal.signal_type, setup_stage: "READY", status: "pending", outcome: "pending", zone_type: signal.zone_type, zone_timeframe: signal.zone_timeframe, zone_high: signal.zone_high, zone_low: signal.zone_low, zone_status: signal.zone_status, entry: signal.entry_price, stop_loss: signal.stop_loss, tp1: signal.take_profit_1, tp2: signal.take_profit_2 });
  } catch (error) {
    if (error.code === "23505") { const duplicate = await pool.query("SELECT * FROM setup_journal WHERE signal_id=$1", [signalId]); return { entry: duplicate.rows[0], created: false }; }
    throw error;
  }
};

const buildFilters = (filters = {}) => {
  const clauses = [], values = [];
  for (const [key, column] of [["symbol", "symbol"], ["strategy_name", "strategy_name"], ["status", "status"], ["outcome", "outcome"]]) if (filters[key]) { values.push(filters[key]); clauses.push(`${column}=$${values.length}`); }
  if (filters.from) { if (Number.isNaN(Date.parse(filters.from))) throw validationError("from must be a valid date"); values.push(filters.from); clauses.push(`created_at >= $${values.length}`); }
  if (filters.to) { if (Number.isNaN(Date.parse(filters.to))) throw validationError("to must be a valid date"); values.push(filters.to); clauses.push(`created_at <= $${values.length}`); }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
};

const listJournalEntries = async (filters) => { const query = buildFilters(filters); const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500); query.values.push(limit); const result = await pool.query(`SELECT * FROM setup_journal ${query.where} ORDER BY created_at DESC LIMIT $${query.values.length}`, query.values); return result.rows; };
const getJournalEntry = async (id) => { if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw validationError("id must be a positive integer"); const result = await pool.query("SELECT * FROM setup_journal WHERE id=$1", [id]); return result.rows[0] || null; };

const updateJournalOutcome = async (id, update) => {
  const allowed = ["outcome", "status", "triggered_at", "closed_at", "max_favourable_move", "max_adverse_move", "final_r_result", "reviewer_notes", "review_status", "tags"];
  const keys = allowed.filter((key) => Object.prototype.hasOwnProperty.call(update, key));
  if (!keys.length) throw validationError("no supported outcome fields supplied");
  if (update.outcome && !OUTCOMES.has(String(update.outcome).toLowerCase())) throw validationError("invalid outcome");
  if (update.status && !OUTCOMES.has(String(update.status).toLowerCase())) throw validationError("invalid status");
  if (update.review_status && !REVIEW_STATUSES.has(String(update.review_status).toLowerCase())) throw validationError("invalid review_status");
  for (const key of ["max_favourable_move", "max_adverse_move", "final_r_result"]) if (update[key] !== undefined && update[key] !== null && !finite(update[key])) throw validationError(`${key} must be numeric`);
  const values = keys.map((key) => ["outcome", "status", "review_status"].includes(key) ? String(update[key]).toLowerCase() : update[key]); values.push(id);
  const result = await pool.query(`UPDATE setup_journal SET ${keys.map((key, index) => `${key}=$${index + 1}`).join(", ")}, updated_at=CURRENT_TIMESTAMP WHERE id=$${values.length} RETURNING *`, values);
  return result.rows[0] || null;
};

const calculateBasicJournalStats = async (filters = {}) => {
  const query = buildFilters(filters);
  const result = await pool.query(`SELECT COUNT(*)::int total_setups, COUNT(*) FILTER (WHERE status IN ('pending','watching','triggered'))::int pending_setups, COUNT(*) FILTER (WHERE outcome = ANY($${query.values.length + 1}))::int completed_setups, COUNT(*) FILTER (WHERE outcome='tp1_hit')::int tp1_count, COUNT(*) FILTER (WHERE outcome='tp2_hit')::int tp2_count, COUNT(*) FILTER (WHERE outcome='stopped_out')::int stopped_out_count, COUNT(*) FILTER (WHERE outcome='invalidated')::int invalidated_count, AVG(final_r_result) FILTER (WHERE final_r_result IS NOT NULL) average_final_r FROM setup_journal ${query.where}`, [...query.values, COMPLETED]);
  const best = await pool.query(`SELECT symbol, COUNT(*)::int completed_count, AVG(final_r_result) average_final_r FROM setup_journal ${query.where}${query.where ? " AND" : " WHERE"} outcome = ANY($${query.values.length + 1}) AND final_r_result IS NOT NULL GROUP BY symbol HAVING COUNT(*) >= 2 ORDER BY AVG(final_r_result) DESC LIMIT 1`, [...query.values, COMPLETED]);
  const stats = result.rows[0];
  const wins = stats.tp1_count + stats.tp2_count;
  return { ...stats, win_rate_approximation: stats.completed_setups ? Number(((wins / stats.completed_setups) * 100).toFixed(2)) : null, average_final_r: stats.average_final_r === null ? null : Number(stats.average_final_r), best_symbol: best.rows[0] ? { ...best.rows[0], average_final_r: Number(best.rows[0].average_final_r) } : null };
};

module.exports = { createJournalEntry, createJournalEntryFromSignal, listJournalEntries, getJournalEntry, updateJournalOutcome, calculateBasicJournalStats };
