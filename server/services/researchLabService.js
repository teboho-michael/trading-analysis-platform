const crypto = require("crypto");
const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");
const { calculateFeatures, INSUFFICIENT_DATA } = require("./featureEngineeringService");
const { classifyMarketCondition, classifyTrendVsMeanReversion } = require("./marketConditionService");
const { discoverPatterns } = require("./patternDiscoveryService");

const SUPPORTED_TIMEFRAMES = new Set(["D1", "H4", "H1"]);
const SUPPORTED_EXPERIMENTS = new Set(["condition_analysis", "feature_analysis", "timeframe_readiness", "strategy_comparison", "parameter_comparison"]);
const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const round = (value, digits = 6) => finite(value) ? Number(Number(value).toFixed(digits)) : null;

const validateSymbol = (value) => {
  const symbol = String(value || "").toUpperCase();
  if (!symbol) throw serviceError("symbol is required");
  try { getInstrument(symbol); } catch (_error) { throw serviceError(`Unsupported symbol: ${symbol}`); }
  return symbol;
};
const validateTimeframe = (value, required = true) => {
  const timeframe = String(value || "").toUpperCase();
  if (!timeframe && !required) return null;
  if (!SUPPORTED_TIMEFRAMES.has(timeframe)) throw serviceError(`Unsupported timeframe: ${timeframe || "missing"}. Research supports D1, H4, and H1 stored candles.`);
  return timeframe;
};
const parseOptionalDate = (value, name, endOfDay = false) => {
  if (!value) return null;
  const text = String(value), date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999Z` : text);
  if (Number.isNaN(date.getTime())) throw serviceError(`${name} must be a valid date`);
  return date;
};
const validateDates = (input) => {
  const dateFrom = parseOptionalDate(input.date_from, "date_from"), dateTo = parseOptionalDate(input.date_to, "date_to", true);
  if (dateFrom && dateTo && dateTo < dateFrom) throw serviceError("date_to must be on or after date_from");
  return { dateFrom, dateTo };
};

const loadStoredCandles = async ({ symbol, timeframe, date_from, date_to, limit = 3000 }, queryable = pool) => {
  const normalizedSymbol = validateSymbol(symbol), normalizedTimeframe = validateTimeframe(timeframe);
  const { dateFrom, dateTo } = validateDates({ date_from, date_to });
  const result = await queryable.query(`SELECT * FROM (SELECT c.open,c.high,c.low,c.close,c.volume,c.candle_time
    FROM candles c JOIN assets a ON a.id=c.asset_id WHERE a.symbol=$1 AND c.timeframe=$2
      AND ($3::timestamp IS NULL OR c.candle_time <= $3)
    ORDER BY c.candle_time DESC LIMIT $4) stored ORDER BY candle_time ASC`, [normalizedSymbol, normalizedTimeframe, dateTo, limit]);
  return { symbol: normalizedSymbol, timeframe: normalizedTimeframe, dateFrom, dateTo, candles: result.rows };
};

const getConditions = async (input = {}) => {
  const loaded = await loadStoredCandles(input);
  const engineered = calculateFeatures(loaded.candles);
  const feature = engineered.latest;
  const condition = classifyMarketCondition({ symbol: loaded.symbol, timeframe: loaded.timeframe, feature });
  const patterns = discoverPatterns({ symbol: loaded.symbol, timeframe: loaded.timeframe, feature, condition });
  const behavior = classifyTrendVsMeanReversion({ symbol: loaded.symbol, timeframe: loaded.timeframe, feature, condition, date_from: loaded.dateFrom, date_to: loaded.dateTo });
  return {
    status: condition.condition === INSUFFICIENT_DATA ? INSUFFICIENT_DATA : "available",
    symbol: loaded.symbol, timeframe: loaded.timeframe,
    requested_range: { date_from: loaded.dateFrom, date_to: loaded.dateTo },
    candle_evidence: { available: engineered.available_candles, required: engineered.required_candles, earliest: loaded.candles[0]?.candle_time || null, latest: loaded.candles.at(-1)?.candle_time || null },
    features_summary: feature || { status: INSUFFICIENT_DATA }, market_condition: condition, pattern_labels: patterns, trend_vs_mean_reversion: behavior,
    research_only: true,
  };
};

const listExperiments = async () => (await pool.query("SELECT * FROM research_experiments ORDER BY created_at DESC,id DESC LIMIT 100")).rows;
const getExperiment = async (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw serviceError("experiment id must be a positive integer");
  return (await pool.query("SELECT * FROM research_experiments WHERE id=$1", [Number(id)])).rows[0] || null;
};
const getExperimentResults = async (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw serviceError("experiment id must be a positive integer");
  return (await pool.query("SELECT * FROM research_experiment_results WHERE experiment_id=$1 ORDER BY id", [Number(id)])).rows;
};

const conditionAnalysis = async (request) => {
  const loaded = await loadStoredCandles(request), engineered = calculateFeatures(loaded.candles);
  const counts = {};
  for (const feature of engineered.series) {
    if (loaded.dateFrom && new Date(feature.candle_time) < loaded.dateFrom) continue;
    const label = classifyMarketCondition({ symbol: loaded.symbol, timeframe: loaded.timeframe, feature }).condition;
    if (label !== INSUFFICIENT_DATA) counts[label] = (counts[label] || 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { status: total ? "completed" : INSUFFICIENT_DATA, summary: { classified_candles: total, condition_counts: counts }, metrics: Object.entries(counts).map(([name, value]) => ({ metric_name: `condition_${name}`, metric_value: value, details: { percentage: round(value * 100 / total, 2) } })) };
};

const featureAnalysis = async (request) => {
  const loaded = await loadStoredCandles(request), engineered = calculateFeatures(loaded.candles);
  const series = engineered.series.filter((feature) => (!loaded.dateFrom || new Date(feature.candle_time) >= loaded.dateFrom) && finite(feature.candle_range) && finite(feature.volatility_proxy) && feature.overextension_basic !== INSUFFICIENT_DATA && feature.choppy_basic !== INSUFFICIENT_DATA);
  if (!series.length) return { status: INSUFFICIENT_DATA, summary: { reason: "No complete feature rows exist in the requested range." }, metrics: [] };
  const averageRange = series.reduce((sum, item) => sum + Number(item.candle_range), 0) / series.length;
  const overextensionCount = series.filter((item) => item.overextension_basic).length, choppyCount = series.filter((item) => item.choppy_basic).length;
  return { status: "completed", summary: { feature_rows: series.length, average_range: round(averageRange), overextension_count: overextensionCount, choppy_count: choppyCount }, metrics: [{ metric_name: "average_range", metric_value: round(averageRange) }, { metric_name: "overextension_count", metric_value: overextensionCount }, { metric_name: "choppy_count", metric_value: choppyCount }] };
};

const timeframeReadiness = async (request) => {
  const symbol = validateSymbol(request.symbol), { dateFrom, dateTo } = validateDates(request);
  const result = await pool.query(`SELECT c.timeframe,COUNT(*)::int available,MIN(c.candle_time) earliest,MAX(c.candle_time) latest FROM candles c JOIN assets a ON a.id=c.asset_id
    WHERE a.symbol=$1 AND c.timeframe=ANY($2) AND ($3::timestamp IS NULL OR c.candle_time <= $3) GROUP BY c.timeframe`, [symbol, ["D1", "H4", "H1"], dateTo]);
  const rows = ["D1", "H4", "H1"].map((timeframe) => { const row = result.rows.find((item) => item.timeframe === timeframe); return { timeframe, available: row?.available || 0, required: 201, ready: (row?.available || 0) >= 201, earliest: row?.earliest || null, latest: row?.latest || null }; });
  return { status: rows.some((row) => row.available) ? "completed" : INSUFFICIENT_DATA, summary: { symbol, date_from: dateFrom, date_to: dateTo, timeframes: rows }, metrics: rows.map((row) => ({ metric_name: `${row.timeframe.toLowerCase()}_available_candles`, metric_value: row.available, timeframe: row.timeframe, details: row })) };
};

const strategyComparison = async (request) => {
  const symbol = validateSymbol(request.symbol), timeframe = validateTimeframe(request.timeframe), { dateFrom, dateTo } = validateDates(request);
  const result = await pool.query(`SELECT r.strategy_version_id,s.strategy_key,s.version,COUNT(DISTINCT r.id)::int completed_runs,COALESCE(SUM(r.completed_setups),0)::int completed_setups,
    ROUND(AVG(r.win_rate),2) win_rate,ROUND(AVG(r.average_r),4) average_r,ROUND(SUM(r.total_r),4) total_r
    FROM backtest_runs r JOIN strategy_versions s ON s.id=r.strategy_version_id WHERE r.status='completed' AND r.symbol=$1 AND r.timeframe=$2
      AND ($3::timestamp IS NULL OR r.date_to >= $3) AND ($4::timestamp IS NULL OR r.date_from <= $4)
    GROUP BY r.strategy_version_id,s.strategy_key,s.version ORDER BY r.strategy_version_id`, [symbol, timeframe, dateFrom, dateTo]);
  if (result.rows.length < 2) return { status: INSUFFICIENT_DATA, summary: { reason: "At least two strategy versions with completed backtests are required.", available_strategies: result.rows }, metrics: [] };
  return { status: "completed", summary: { strategies: result.rows }, metrics: result.rows.flatMap((row) => ["completed_setups", "win_rate", "average_r", "total_r"].filter((key) => finite(row[key])).map((key) => ({ metric_name: `strategy_${row.strategy_version_id}_${key}`, metric_value: Number(row[key]), details: row }))) };
};

const parameterComparison = async (request) => {
  const loaded = await loadStoredCandles(request), ema100 = calculateFeatures(loaded.candles, { emaPeriod: 100 }), ema200 = calculateFeatures(loaded.candles, { emaPeriod: 200 });
  if (ema200.status === INSUFFICIENT_DATA) return { status: INSUFFICIENT_DATA, summary: { reason: "EMA 200 comparison requires at least 200 stored candles.", ema_100_status: ema100.status, ema_200_status: ema200.status }, metrics: [] };
  return { status: "completed", summary: { scope: "feature_readiness_only", live_strategy_unchanged: true, ema_100: ema100.latest.ema, ema_200: ema200.latest.ema, ema_100_distance: ema100.latest.distance_from_ema, ema_200_distance: ema200.latest.distance_from_ema }, metrics: [{ metric_name: "ema_100", metric_value: ema100.latest.ema }, { metric_name: "ema_200", metric_value: ema200.latest.ema }, { metric_name: "ema_100_distance", metric_value: ema100.latest.distance_from_ema }, { metric_name: "ema_200_distance", metric_value: ema200.latest.distance_from_ema }] };
};

const executeExperiment = (request) => ({ condition_analysis: conditionAnalysis, feature_analysis: featureAnalysis, timeframe_readiness: timeframeReadiness, strategy_comparison: strategyComparison, parameter_comparison: parameterComparison }[request.experiment_type](request));

const runExperiment = async (input = {}) => {
  const experimentType = String(input.experiment_type || "");
  if (!SUPPORTED_EXPERIMENTS.has(experimentType)) throw serviceError(`Unsupported experiment_type: ${experimentType || "missing"}`);
  const symbol = validateSymbol(input.symbol), timeframe = experimentType === "timeframe_readiness" ? validateTimeframe(input.timeframe, false) || "MULTI" : validateTimeframe(input.timeframe);
  const dates = validateDates(input), parameters = input.parameters && typeof input.parameters === "object" && !Array.isArray(input.parameters) ? input.parameters : {};
  const request = { ...input, experiment_type: experimentType, symbol, timeframe: timeframe === "MULTI" ? null : timeframe, date_from: dates.dateFrom, date_to: dates.dateTo, parameters };
  const key = `${experimentType}-${symbol}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const created = await pool.query(`INSERT INTO research_experiments (experiment_key,experiment_name,description,experiment_type,base_strategy_version_id,parameters_json,status)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,'running') RETURNING *`, [key, `${experimentType.replaceAll("_", " ")} · ${symbol}`, "Deterministic stored-data research experiment.", experimentType, input.base_strategy_version_id || null, JSON.stringify({ ...parameters, symbol, timeframe, date_from: dates.dateFrom, date_to: dates.dateTo })]);
  const experiment = created.rows[0];
  try {
    const outcome = await executeExperiment(request), client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const metric of outcome.metrics) await client.query(`INSERT INTO research_experiment_results (experiment_id,symbol,timeframe,date_from,date_to,metric_name,metric_value,details_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [experiment.id, symbol, metric.timeframe || timeframe, dates.dateFrom, dates.dateTo, metric.metric_name, finite(metric.metric_value) ? metric.metric_value : null, JSON.stringify(metric.details || {})]);
      const updated = await client.query("UPDATE research_experiments SET status=$1,completed_at=CURRENT_TIMESTAMP,result_summary_json=$2::jsonb WHERE id=$3 RETURNING *", [outcome.status, JSON.stringify(outcome.summary), experiment.id]);
      await client.query("COMMIT");
      return { experiment: updated.rows[0], results: await getExperimentResults(experiment.id) };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) {
    await pool.query("UPDATE research_experiments SET status='failed',completed_at=CURRENT_TIMESTAMP,error_message=$1 WHERE id=$2", [error.message, experiment.id]);
    throw error;
  }
};

module.exports = { SUPPORTED_EXPERIMENTS, loadStoredCandles, getConditions, listExperiments, getExperiment, getExperimentResults, runExperiment };
