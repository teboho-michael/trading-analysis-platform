const pool = require("../db/connection");
const { calculateTrendFromCandles } = require("../analysis/trendEngine");
const { detectZones } = require("../analysis/zoneEngine");
const { calculateRiskLevels } = require("../analysis/riskEngine");
const { evaluateSetupQuality } = require("../analysis/setupQualityEngine");
const { getInstrument } = require("../market/instrumentRegistry");
const strategyRegistry = require("./strategyRegistryService");
const readinessService = require("./candleReadinessService");
const { MT5_SOURCE, sourceMetadataForScope, evidencePolicy } = require("./mt5EvidencePolicy");

const SUPPORTED_TIMEFRAMES = new Set(["H1"]);
const REQUIRED_TREND_CANDLES = 201;
const ZONE_PROXIMITY_PERCENT = 0.003;
const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const serviceError = (message, statusCode = 400, details = {}) => Object.assign(new Error(message), { statusCode, ...details });
const asDate = (value, name, endOfDay = false) => {
  if (!value) throw serviceError(`${name} is required`);
  const text = String(value);
  const date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999Z` : text);
  if (Number.isNaN(date.getTime())) throw serviceError(`${name} must be a valid date`);
  return date;
};
const round = (value, digits = 4) => finite(value) ? Number(Number(value).toFixed(digits)) : null;

const validateRequest = (input = {}) => {
  if (!Number.isInteger(Number(input.strategy_version_id)) || Number(input.strategy_version_id) <= 0) throw serviceError("strategy_version_id must be a positive integer");
  const symbol = String(input.symbol || "").toUpperCase();
  if (!symbol) throw serviceError("symbol is required");
  try { getInstrument(symbol); } catch (_error) { throw serviceError(`Unsupported symbol: ${symbol}`); }
  const timeframe = String(input.timeframe || "").toUpperCase();
  if (!SUPPORTED_TIMEFRAMES.has(timeframe)) throw serviceError("Unsupported timeframe. supply_demand_ema_200 v1 supports H1 only.");
  const dateFrom = asDate(input.date_from, "date_from");
  const dateTo = asDate(input.date_to, "date_to", true);
  if (dateTo < dateFrom) throw serviceError("date_to must be on or after date_from");
  return { strategyVersionId: Number(input.strategy_version_id), symbol, timeframe, dateFrom, dateTo };
};

const loadHistoricalCandles = async (symbol, _timeframe, dateFrom, dateTo, queryable = pool) => {
  const result = await queryable.query(`SELECT c.timeframe,c.open,c.high,c.low,c.close,c.volume,c.candle_time
    FROM candles c JOIN assets a ON a.id=c.asset_id
    WHERE a.symbol=$1 AND c.timeframe=ANY($2) AND c.candle_time <= $3 AND c.source=$4
    ORDER BY c.candle_time ASC`, [symbol, ["H1", "H4", "D1"], dateTo, MT5_SOURCE]);
  const grouped = { H1: [], H4: [], D1: [] };
  for (const candle of result.rows) grouped[candle.timeframe]?.push(candle);
  return { ...grouped, dateFrom, dateTo };
};

const getZoneProximity = (price, zone) => {
  if (!finite(price) || !zone) return { isNearZone: false, distanceFromZone: null, distancePercent: null };
  const current = Number(price), high = Number(zone.zone_high), low = Number(zone.zone_low), buffer = current * ZONE_PROXIMITY_PERCENT;
  const distance = current > high ? current - high : current < low ? low - current : 0;
  return { isNearZone: current >= low - buffer && current <= high + buffer, distanceFromZone: round(distance, 10), distancePercent: round((distance / current) * 100, 4) };
};

const zoneStateAt = (zone, h4Candles) => {
  const sourceIndex = h4Candles.findIndex((candle) => new Date(candle.candle_time).getTime() === new Date(zone.source_time).getTime());
  const later = h4Candles.slice(sourceIndex >= 0 ? sourceIndex + 2 : 0);
  let touchedAt = null;
  for (const candle of later) {
    const close = Number(candle.close), high = Number(candle.high), low = Number(candle.low);
    const broken = zone.zone_type === "demand" ? close < Number(zone.zone_low) : close > Number(zone.zone_high);
    if (broken) return null;
    if (!touchedAt && high >= Number(zone.zone_low) && low <= Number(zone.zone_high)) touchedAt = candle.candle_time;
  }
  return { ...zone, timeframe: "H4", status: "active", broken_at: null, mitigated_at: touchedAt, touched_at: touchedAt };
};

const selectHistoricalZone = (h4Candles) => {
  const zones = detectZones(h4Candles);
  for (const zone of zones) {
    const state = zoneStateAt(zone, h4Candles);
    if (state) return state;
  }
  return null;
};

const simulateSetupOutcome = (setup, futureCandles) => {
  let active = false, triggeredAt = null, maxFavourableMove = null, maxAdverseMove = null;
  const buy = setup.direction === "BUY", risk = Math.abs(Number(setup.entry) - Number(setup.stop_loss));
  for (const candle of futureCandles) {
    const high = Number(candle.high), low = Number(candle.low);
    if (!active && low <= Number(setup.entry) && high >= Number(setup.entry)) { active = true; triggeredAt = candle.candle_time; }
    if (!active) continue;
    const favourable = buy ? high - Number(setup.entry) : Number(setup.entry) - low;
    const adverse = buy ? Number(setup.entry) - low : high - Number(setup.entry);
    maxFavourableMove = Math.max(maxFavourableMove ?? 0, favourable);
    maxAdverseMove = Math.max(maxAdverseMove ?? 0, adverse);
    const tp1Hit = finite(setup.tp1) && (buy ? high >= Number(setup.tp1) : low <= Number(setup.tp1));
    const tp2Hit = finite(setup.tp2) && (buy ? high >= Number(setup.tp2) : low <= Number(setup.tp2));
    const stopHit = buy ? low <= Number(setup.stop_loss) : high >= Number(setup.stop_loss);
    if ((tp1Hit || tp2Hit) && stopHit) return { triggered_at: triggeredAt, closed_at: candle.candle_time, outcome: "ambiguous", final_r: null, max_favourable_move: round(maxFavourableMove, 10), max_adverse_move: round(maxAdverseMove, 10), requires_review: true, review_reason: "Take-profit and stop-loss levels were touched in the same candle; intrabar order cannot be determined." };
    if (tp2Hit) return { triggered_at: triggeredAt, closed_at: candle.candle_time, outcome: "tp2_hit", final_r: 3, max_favourable_move: round(maxFavourableMove, 10), max_adverse_move: round(maxAdverseMove, 10), requires_review: false, review_reason: null };
    if (tp1Hit) return { triggered_at: triggeredAt, closed_at: candle.candle_time, outcome: "tp1_hit", final_r: 2, max_favourable_move: round(maxFavourableMove, 10), max_adverse_move: round(maxAdverseMove, 10), requires_review: false, review_reason: null };
    if (stopHit) return { triggered_at: triggeredAt, closed_at: candle.candle_time, outcome: "stopped_out", final_r: -1, max_favourable_move: round(maxFavourableMove, 10), max_adverse_move: round(maxAdverseMove, 10), requires_review: false, review_reason: null };
  }
  return { triggered_at: triggeredAt, closed_at: null, outcome: active ? "open" : "not_triggered", final_r: null, max_favourable_move: round(maxFavourableMove, 10), max_adverse_move: round(maxAdverseMove, 10), requires_review: false, review_reason: null, risk_amount: round(risk, 10) };
};

const evaluateStrategyOnCandles = (strategyVersion, candles, symbol) => {
  if (strategyVersion.strategy_key !== "supply_demand_ema_200") throw serviceError("This strategy version has no executable backtest implementation.", 400);
  for (const timeframe of ["H1", "H4", "D1"]) if (candles[timeframe].length < REQUIRED_TREND_CANDLES) throw serviceError(`Not enough stored candles for this backtest range. ${timeframe} requires at least ${REQUIRED_TREND_CANDLES}; found ${candles[timeframe].length}.`, 400, { code: "INSUFFICIENT_CANDLES" });
  const results = [], usedZones = new Set();
  let candlesEvaluated = 0;
  for (let index = REQUIRED_TREND_CANDLES - 1; index < candles.H1.length; index += 1) {
    const current = candles.H1[index], time = new Date(current.candle_time);
    if (time < candles.dateFrom || time > candles.dateTo) continue;
    candlesEvaluated += 1;
    const h1 = candles.H1.slice(0, index + 1), h4 = candles.H4.filter((c) => new Date(c.candle_time) <= time), d1 = candles.D1.filter((c) => new Date(c.candle_time) <= time);
    if (h4.length < REQUIRED_TREND_CANDLES || d1.length < REQUIRED_TREND_CANDLES) continue;
    const trends = { h1: calculateTrendFromCandles(h1, 200), h4: calculateTrendFromCandles(h4, 200), daily: calculateTrendFromCandles(d1, 200) };
    const activeZone = selectHistoricalZone(h4);
    if (!activeZone) continue;
    const direction = activeZone.zone_type === "demand" ? "BUY" : "SELL";
    const zoneKey = `${activeZone.zone_type}:${activeZone.source_time}`;
    if (usedZones.has(zoneKey)) continue;
    const zoneProximity = getZoneProximity(current.close, activeZone);
    const risk = calculateRiskLevels(symbol, `${direction} SETUP`, current.close, activeZone);
    const quality = evaluateSetupQuality({ daily: trends.daily, h4: trends.h4, h1: trends.h1, activeZone, zoneProximity, risk, duplicateSignal: false });
    if (quality.setupStage !== "READY" || !risk) continue;
    usedZones.add(zoneKey);
    const setup = { symbol, setup_time: current.candle_time, direction, setup_stage: quality.setupStage, quality_score: quality.qualityScore, entry: risk.entryPrice, stop_loss: risk.stopLoss, tp1: risk.takeProfit1, tp2: risk.takeProfit2 };
    results.push({ ...setup, ...simulateSetupOutcome(setup, candles.H1.slice(index + 1)), details_json: { strategy_key: strategyVersion.strategy_key, strategy_version: strategyVersion.version, zone: activeZone, trends: { d1: trends.daily.trend, h4: trends.h4.trend, h1: trends.h1.trend }, confirmation_checklist: quality.confirmationChecklist, evaluation_policy: "as_of_setup_time_stored_candles_only" } });
  }
  return { results, candlesEvaluated };
};

const calculateBacktestMetrics = (results) => {
  const completed = results.filter((item) => finite(item.final_r));
  const totalR = completed.reduce((sum, item) => sum + Number(item.final_r), 0);
  let equity = 0, peak = 0, maxDrawdown = 0;
  for (const item of completed) { equity += Number(item.final_r); peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); }
  const wins = completed.filter((item) => Number(item.final_r) > 0).length;
  const summarize = (items) => { const done = items.filter((item) => finite(item.final_r)), sum = done.reduce((total, item) => total + Number(item.final_r), 0); return { setups_found: items.length, completed_setups: done.length, win_rate: done.length ? round((done.filter((item) => Number(item.final_r) > 0).length / done.length) * 100, 2) : null, average_r: done.length ? round(sum / done.length) : null, total_r: done.length ? round(sum) : null }; };
  const qualityRanges = [{ label: "0-25", min: 0, max: 25 }, { label: "26-50", min: 26, max: 50 }, { label: "51-75", min: 51, max: 75 }, { label: "76-100", min: 76, max: 100 }];
  return { setups_found: results.length, completed_setups: completed.length, win_rate: completed.length ? round((wins / completed.length) * 100, 2) : null, average_r: completed.length ? round(totalR / completed.length) : null, total_r: completed.length ? round(totalR) : null, max_drawdown_r: completed.length ? round(maxDrawdown) : null, tp1_count: results.filter((item) => item.outcome === "tp1_hit").length, tp2_count: results.filter((item) => item.outcome === "tp2_hit").length, stopped_out_count: results.filter((item) => item.outcome === "stopped_out").length, requires_review_count: results.filter((item) => item.requires_review).length, by_direction: ["BUY", "SELL"].map((direction) => ({ direction, ...summarize(results.filter((item) => item.direction === direction)) })), by_quality_range: qualityRanges.map((range) => ({ quality_range: range.label, ...summarize(results.filter((item) => Number(item.quality_score) >= range.min && Number(item.quality_score) <= range.max)) })), historical_evidence_score: null, scoring_components: { technical_score: "quality_score", historical_evidence_score: null, risk_score: null, market_condition_score: null, final_confidence_score: null } };
};

const saveBacktestRun = async (runId, strategyVersionId, symbol, evaluation, metrics) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const result of evaluation.results) await client.query(`INSERT INTO backtest_results
      (backtest_run_id,symbol,strategy_version_id,setup_time,direction,setup_stage,quality_score,entry,stop_loss,tp1,tp2,triggered_at,closed_at,outcome,final_r,max_favourable_move,max_adverse_move,requires_review,review_reason,details_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)`, [runId, symbol, strategyVersionId, result.setup_time, result.direction, result.setup_stage, result.quality_score, result.entry, result.stop_loss, result.tp1, result.tp2, result.triggered_at, result.closed_at, result.outcome, result.final_r, result.max_favourable_move, result.max_adverse_move, result.requires_review, result.review_reason, JSON.stringify(result.details_json)]);
    const updated = await client.query(`UPDATE backtest_runs SET status='completed',completed_at=CURRENT_TIMESTAMP,candles_evaluated=$1,setups_found=$2,completed_setups=$3,win_rate=$4,average_r=$5,total_r=$6,max_drawdown_r=$7,result_summary_json=$8::jsonb,error_message=NULL WHERE id=$9 RETURNING *`, [evaluation.candlesEvaluated, metrics.setups_found, metrics.completed_setups, metrics.win_rate, metrics.average_r, metrics.total_r, metrics.max_drawdown_r, JSON.stringify(metrics), runId]);
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

const runBacktest = async (input = {}) => {
  const request = validateRequest(input);
  const strategy = await strategyRegistry.getStrategyVersion(request.strategyVersionId);
  if (!strategy) throw serviceError("Strategy version not found", 404);
  if (strategy.timeframe_primary !== request.timeframe) throw serviceError(`Strategy ${strategy.strategy_key} ${strategy.version} requires ${strategy.timeframe_primary}.`);
  const created = await pool.query(`INSERT INTO backtest_runs (strategy_version_id,symbol,timeframe,date_from,date_to,status,started_at) VALUES ($1,$2,$3,$4,$5,'running',CURRENT_TIMESTAMP) RETURNING *`, [request.strategyVersionId, request.symbol, request.timeframe, request.dateFrom, request.dateTo]);
  const runId = created.rows[0].id;
  try {
    const readiness = await readinessService.checkStrategyReadiness({ strategy_version_id: request.strategyVersionId, symbol: request.symbol, date_from: request.dateFrom, date_to: request.dateTo });
    if (!readiness.ready) {
      const summary = { failure_type: "missing_mt5_data", missing_timeframes: readiness.missing_timeframes, readiness, historical_evidence_score: null, ...evidencePolicy() };
      const message = `Required historical data is missing: ${readiness.missing_timeframes.join(", ")}.`;
      await pool.query("UPDATE backtest_runs SET status='failed',completed_at=CURRENT_TIMESTAMP,result_summary_json=$1::jsonb,error_message=$2 WHERE id=$3", [JSON.stringify(summary), message, runId]);
      throw serviceError(message, 400, { code: "missing_mt5_data", readiness, alreadySavedFailure: true });
    }
    const candles = await loadHistoricalCandles(request.symbol, request.timeframe, request.dateFrom, request.dateTo);
    const evaluation = evaluateStrategyOnCandles(strategy, candles, request.symbol);
    const sourceMetadata = await sourceMetadataForScope({ symbol: request.symbol, dateTo: request.dateTo });
    const metrics = { ...calculateBacktestMetrics(evaluation.results), ...sourceMetadata, ...evidencePolicy() };
    return await saveBacktestRun(runId, request.strategyVersionId, request.symbol, evaluation, metrics);
  } catch (error) {
    if (!error.alreadySavedFailure) await pool.query("UPDATE backtest_runs SET status='failed',completed_at=CURRENT_TIMESTAMP,error_message=$1 WHERE id=$2", [error.message, runId]);
    error.backtestRunId = runId;
    throw error;
  }
};

const listBacktests = async () => (await pool.query(`SELECT r.*,s.strategy_key,s.strategy_name,s.version strategy_version FROM backtest_runs r JOIN strategy_versions s ON s.id=r.strategy_version_id ORDER BY r.created_at DESC,r.id DESC LIMIT 100`)).rows;
const getBacktest = async (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw serviceError("backtest id must be a positive integer");
  return (await pool.query(`SELECT r.*,s.strategy_key,s.strategy_name,s.version strategy_version FROM backtest_runs r JOIN strategy_versions s ON s.id=r.strategy_version_id WHERE r.id=$1`, [Number(id)])).rows[0] || null;
};
const getBacktestResults = async (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw serviceError("backtest id must be a positive integer");
  return (await pool.query("SELECT * FROM backtest_results WHERE backtest_run_id=$1 ORDER BY setup_time ASC,id ASC", [Number(id)])).rows;
};

module.exports = { runBacktest, loadHistoricalCandles, evaluateStrategyOnCandles, simulateSetupOutcome, calculateBacktestMetrics, saveBacktestRun, listBacktests, getBacktest, getBacktestResults };
