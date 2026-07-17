const pool = require("../db/connection");
const { getLivePrices } = require("../market/livePriceService");
const { MT5_SOURCE } = require("./mt5MarketMetadataService");

const OPEN_LIFECYCLE = ["watching", "ready", "triggered", "active", "requires_review"];
const terminalOutcomes = new Set(["tp1_hit", "tp2_hit", "won", "lost", "stopped_out", "invalidated", "expired", "cancelled", "manually_closed"]);
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });

const validateId = (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw validationError("id must be a positive integer");
  return Number(id);
};

const calculateDistanceMetrics = (entry, latestPrice) => {
  if (!finite(latestPrice)) return { distance_to_entry: null, distance_to_stop_loss: null, distance_to_tp1: null, distance_to_tp2: null };
  const price = Number(latestPrice);
  const distance = (level) => finite(level) ? Number((Number(level) - price).toFixed(10)) : null;
  return { distance_to_entry: distance(entry.entry), distance_to_stop_loss: distance(entry.stop_loss), distance_to_tp1: distance(entry.tp1), distance_to_tp2: distance(entry.tp2) };
};

const touched = (candle, level) => finite(level) && Number(candle.low) <= Number(level) && Number(candle.high) >= Number(level);

const evaluateCandle = (entry, candle, active = false) => {
  const buy = entry.direction === "BUY";
  const entryHit = touched(candle, entry.entry);
  if (!active && !entryHit) return null;
  const tp1Hit = finite(entry.tp1) && (buy ? Number(candle.high) >= Number(entry.tp1) : Number(candle.low) <= Number(entry.tp1));
  const tp2Hit = finite(entry.tp2) && (buy ? Number(candle.high) >= Number(entry.tp2) : Number(candle.low) <= Number(entry.tp2));
  const stopHit = finite(entry.stop_loss) && (buy ? Number(candle.low) <= Number(entry.stop_loss) : Number(candle.high) >= Number(entry.stop_loss));
  if ((tp1Hit || tp2Hit) && stopHit) return { outcome: "ambiguous", lifecycle_status: "requires_review", requires_review: true, review_reason: "Take-profit and stop-loss levels were touched in the same candle; intrabar order cannot be determined." };
  if (tp2Hit) return { outcome: "tp2_hit", lifecycle_status: "completed", final_r_result: finite(entry.risk_reward_tp2) ? Number(entry.risk_reward_tp2) : null, closed_at: candle.candle_time };
  if (tp1Hit) return { outcome: "tp1_hit", lifecycle_status: "completed", final_r_result: finite(entry.risk_reward_tp1) ? Number(entry.risk_reward_tp1) : null, closed_at: candle.candle_time };
  if (stopHit) return { outcome: "stopped_out", lifecycle_status: "completed", final_r_result: -1, closed_at: candle.candle_time };
  if (entryHit || active) return active ? null : { outcome: "triggered", lifecycle_status: "active", triggered_at: entry.triggered_at || candle.candle_time };
  return null;
};

const crossed = (previous, current, level) => finite(previous) && finite(current) && finite(level)
  && Math.min(Number(previous), Number(current)) <= Number(level)
  && Math.max(Number(previous), Number(current)) >= Number(level);

const evaluatePrice = (entry, latestPrice) => crossed(entry.lifecycle_last_price, latestPrice, entry.entry)
  ? { outcome: "triggered", lifecycle_status: "active", triggered_at: entry.triggered_at || new Date().toISOString() }
  : null;

const evaluateSetupAgainstMarketData = (entry, marketData = {}) => {
  if (entry.entry_type === "provider_limited" || entry.source_mode === "provider_limited") return { changed: false, reason: "Provider limitation prevents lifecycle evaluation." };
  if (entry.entry_type !== "setup") return { changed: false, reason: `${entry.entry_type} entries are informational and are not automatically evaluated.` };
  if (!finite(entry.entry) || !finite(entry.stop_loss) || (!finite(entry.tp1) && !finite(entry.tp2))) return { changed: false, reason: "Setup levels are incomplete; lifecycle was not evaluated." };
  if (!["BUY", "SELL"].includes(entry.direction)) return { changed: false, reason: "Setup direction is invalid; lifecycle was not evaluated." };
  const candles = [...(marketData.candles || [])].sort((a, b) => new Date(a.candle_time) - new Date(b.candle_time));
  let evaluation = null;
  let active = entry.outcome === "triggered" || entry.lifecycle_status === "active";
  for (const candle of candles) {
    const next = evaluateCandle(entry, candle, active);
    if (!next) continue;
    evaluation = next;
    if (next.lifecycle_status === "active") active = true;
    else break;
  }
  if (!evaluation && finite(marketData.latestPrice)) evaluation = evaluatePrice(entry, marketData.latestPrice);
  if (!evaluation) return { changed: false, reason: candles.length || finite(marketData.latestPrice) ? "No lifecycle level was reached by the available market data." : "Insufficient market data for lifecycle update" };
  return { changed: evaluation.outcome !== entry.outcome || evaluation.lifecycle_status !== entry.lifecycle_status, ...evaluation };
};

const buildLifecycleReason = (_entry, evaluation) => evaluation.reason
  || (evaluation.lifecycle_status === "requires_review" ? evaluation.review_reason : `Lifecycle advanced to ${evaluation.lifecycle_status}: ${evaluation.outcome}.`);

const getOpenLifecycleEntries = async (filters = {}) => {
  const values = [OPEN_LIFECYCLE], clauses = ["lifecycle_status = ANY($1)"];
  if (filters.symbol) { values.push(String(filters.symbol).toUpperCase()); clauses.push(`symbol=$${values.length}`); }
  if (filters.entry_type) { values.push(filters.entry_type); clauses.push(`entry_type=$${values.length}`); }
  const result = await pool.query(`SELECT * FROM setup_journal WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC`, values);
  return result.rows.map((entry) => ({ ...entry, ...calculateDistanceMetrics(entry, entry.lifecycle_last_price) }));
};

const getMarketData = async (entry) => {
  const result = await pool.query(`SELECT c.high,c.low,c.close,c.candle_time FROM candles c JOIN assets a ON a.id=c.asset_id
    WHERE a.symbol=$1 AND c.timeframe=$2 AND c.candle_time >= $3 AND ($4::timestamp IS NULL OR c.candle_time > $4)
    AND c.source=$5
    ORDER BY c.candle_time ASC LIMIT 500`, [entry.symbol, entry.timeframe || "H1", entry.created_at, entry.lifecycle_last_candle_time, MT5_SOURCE]);
  let quote = null, quoteError = null;
  try {
    const live = await getLivePrices([entry.symbol]);
    quote = live.prices.find((item) => item.symbol === entry.symbol) || null;
    quoteError = live.errors?.[0] || null;
  } catch (error) { quoteError = error.details?.[0] || { error: error.message }; }
  const freshTickPrice = quote?.status === "live" && quote?.freshness === "live" && quote?.is_fresh === true ? quote.price : null;
  return { candles: result.rows, latestPrice: freshTickPrice, quote, quoteError };
};

const updateLifecycleForEntry = async (id, options = {}) => {
  const result = await pool.query("SELECT * FROM setup_journal WHERE id=$1", [validateId(id)]);
  const entry = result.rows[0];
  if (!entry) return null;
  if (terminalOutcomes.has(entry.outcome)) return { entry, updated: false, skipped: true, reason: "Lifecycle is already complete." };
  if (entry.entry_type === "provider_limited") return { entry, updated: false, skipped: true, reason: "Provider limitation prevents lifecycle evaluation." };
  if (entry.entry_type !== "setup") return { entry, updated: false, skipped: true, reason: `${entry.entry_type} entries are not automatically evaluated.` };
  const marketData = options.marketData || await getMarketData(entry);
  const evaluation = evaluateSetupAgainstMarketData(entry, marketData);
  const reason = marketData.quoteError && !marketData.candles.length && !finite(marketData.latestPrice)
    ? `Insufficient market data for lifecycle update: ${marketData.quoteError.message || marketData.quoteError.error || marketData.quoteError.code}` : buildLifecycleReason(entry, evaluation);
  const latestCandle = marketData.candles?.at(-1);
  const latestPrice = finite(marketData.latestPrice) ? Number(marketData.latestPrice) : null;
  const values = [evaluation.outcome || entry.outcome, evaluation.lifecycle_status || entry.lifecycle_status, latestPrice, latestCandle?.candle_time || entry.lifecycle_last_candle_time, reason, Boolean(evaluation.requires_review), evaluation.review_reason || entry.review_reason, evaluation.triggered_at || entry.triggered_at, evaluation.final_r_result ?? entry.final_r_result, evaluation.closed_at || entry.closed_at, id];
  const updated = await pool.query(`UPDATE setup_journal SET outcome=$1,lifecycle_status=$2,lifecycle_last_checked_at=CURRENT_TIMESTAMP,
    lifecycle_last_price=$3,lifecycle_last_candle_time=$4,lifecycle_reason=$5,lifecycle_update_count=lifecycle_update_count+1,
    requires_review=$6,review_reason=$7,triggered_at=$8,final_r_result=$9,
    closed_at=CASE WHEN $2='completed' THEN COALESCE(closed_at,$10,CURRENT_TIMESTAMP) ELSE closed_at END,
    status=CASE WHEN $2='active' THEN 'triggered' WHEN $2='completed' THEN $1 ELSE status END,
    updated_at=CURRENT_TIMESTAMP WHERE id=$11 RETURNING *`, values);
  return { entry: { ...updated.rows[0], ...calculateDistanceMetrics(updated.rows[0], latestPrice) }, updated: evaluation.changed, skipped: !evaluation.changed, requiresReview: Boolean(evaluation.requires_review), reason };
};

const updateLifecycleForOpenEntries = async (filters = {}) => {
  const entries = await getOpenLifecycleEntries(filters), results = [];
  for (const entry of entries) results.push(await updateLifecycleForEntry(entry.id));
  return { updated: results.filter((item) => item.updated).length, skipped: results.filter((item) => item.skipped).length, requiresReview: results.filter((item) => item.requiresReview).length, results };
};

module.exports = { OPEN_LIFECYCLE, getOpenLifecycleEntries, updateLifecycleForEntry, updateLifecycleForOpenEntries, evaluateSetupAgainstMarketData, calculateDistanceMetrics, buildLifecycleReason };
