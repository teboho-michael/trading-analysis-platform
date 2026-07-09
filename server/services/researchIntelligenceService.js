const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");
const strategyRegistry = require("./strategyRegistryService");
const lab = require("./researchLabService");

const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const recommendation = (summary) => {
  if (summary.completed_setups < 10) return { status: "insufficient_data", evidence_status: "insufficient_data", reason: summary.completed_setups ? `Only ${summary.completed_setups} completed setups are available; at least 10 are required for a preliminary recommendation.` : "No completed backtest setups are available yet.", recommendation: "Collect required D1/H4/H1 data and run completed backtests before approving this strategy for this symbol.", historical_evidence_score: null };
  const winRate = Number(summary.win_rate), averageR = Number(summary.average_r);
  if (summary.requires_review_count / summary.completed_setups > 0.2) return { status: "weak_evidence", evidence_status: "weak_evidence", reason: "Too many completed setups require manual review for reliable interpretation.", recommendation: "Review ambiguous outcomes before using this evidence in forward testing.", historical_evidence_score: null };
  if (averageR > 0.5 && winRate >= 50 && summary.completed_setups >= 30) return { status: "strong", evidence_status: "strong", reason: "At least 30 completed setups show positive average R and a win rate of at least 50%.", recommendation: "Continue controlled forward testing with the current rules.", historical_evidence_score: Math.min(100, round(50 + averageR * 15 + (winRate - 50))) };
  if (averageR > 0 && winRate >= 40) return { status: "promising", evidence_status: "moderate", reason: "Completed backtests show positive average R and an acceptable preliminary win rate.", recommendation: "Continue forward testing and gather more completed evidence.", historical_evidence_score: Math.min(85, round(45 + averageR * 15 + Math.max(0, winRate - 40))) };
  if (averageR < 0) return { status: "needs_adjustment", evidence_status: "moderate", reason: "Completed evidence has negative average R.", recommendation: "Review strategy rules for this symbol before further forward testing.", historical_evidence_score: Math.max(0, round(40 + averageR * 15)) };
  return { status: "avoid_for_now", evidence_status: "moderate", reason: "Completed evidence does not yet show a positive expectancy.", recommendation: "Do not approve this strategy for this symbol until stronger evidence is available.", historical_evidence_score: Math.max(0, round(winRate / 2)) };
};

const getResearchIntelligence = async ({ strategy_version_id, symbol } = {}) => {
  let strategyId = null;
  if (strategy_version_id !== undefined && strategy_version_id !== "") {
    if (!Number.isInteger(Number(strategy_version_id)) || Number(strategy_version_id) <= 0) throw serviceError("strategy_version_id must be a positive integer");
    const strategy = await strategyRegistry.getStrategyVersion(strategy_version_id);
    if (!strategy) throw serviceError("Strategy version not found", 404);
    strategyId = Number(strategy_version_id);
  }
  let normalizedSymbol = null;
  if (symbol) { normalizedSymbol = String(symbol).toUpperCase(); try { getInstrument(normalizedSymbol); } catch (_error) { throw serviceError(`Unsupported symbol: ${normalizedSymbol}`); } }
  const result = await pool.query(`SELECT r.symbol,
    COUNT(DISTINCT r.id)::int total_runs,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status='completed')::int completed_runs,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status='failed')::int failed_runs,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status='failed' AND (r.result_summary_json->>'failure_type'='missing_data' OR r.result_summary_json ? 'missing_timeframes' OR r.error_message ILIKE 'Not enough stored candles%' OR r.error_message ILIKE 'Required historical data is missing%'))::int missing_data_runs,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status='completed' AND r.setups_found=0)::int completed_no_setups_runs,
    COUNT(br.id) FILTER (WHERE br.final_r IS NOT NULL)::int completed_setups,
    COUNT(br.id) FILTER (WHERE br.outcome='tp1_hit')::int tp1_count,
    COUNT(br.id) FILTER (WHERE br.outcome='tp2_hit')::int tp2_count,
    COUNT(br.id) FILTER (WHERE br.outcome='stopped_out')::int stopped_out_count,
    COUNT(br.id) FILTER (WHERE br.requires_review)::int requires_review_count,
    ROUND(AVG(br.final_r) FILTER (WHERE br.final_r IS NOT NULL),4) average_r,
    ROUND(SUM(br.final_r) FILTER (WHERE br.final_r IS NOT NULL),4) total_r,
    ROUND(100.0*COUNT(br.id) FILTER (WHERE br.final_r>0)/NULLIF(COUNT(br.id) FILTER (WHERE br.final_r IS NOT NULL),0),2) win_rate
    FROM backtest_runs r LEFT JOIN backtest_results br ON br.backtest_run_id=r.id
    WHERE ($1::bigint IS NULL OR r.strategy_version_id=$1) AND ($2::text IS NULL OR r.symbol=$2)
    GROUP BY r.symbol ORDER BY r.symbol`, [strategyId, normalizedSymbol]);
  const emptySummary = normalizedSymbol ? { symbol: normalizedSymbol, total_runs: 0, completed_runs: 0, failed_runs: 0, missing_data_runs: 0, completed_no_setups_runs: 0, completed_setups: 0, tp1_count: 0, tp2_count: 0, stopped_out_count: 0, requires_review_count: 0, average_r: null, total_r: null, win_rate: null } : null;
  const symbols = (result.rows.length ? result.rows : emptySummary ? [emptySummary] : []).map((row) => ({ ...row, ...recommendation(row) }));
  const enough = symbols.filter((item) => item.completed_setups >= 10);
  const ranked = [...enough].sort((a, b) => Number(b.average_r) - Number(a.average_r));
  const completedSetups = symbols.reduce((sum, item) => sum + item.completed_setups, 0);
  const conditionPerformance = await getConditionPerformance({ strategyId, symbol: normalizedSymbol });
  return { strategy_version_id: strategyId, symbol: normalizedSymbol, overall_status: completedSetups >= 10 ? "evidence_available" : "insufficient_data", evidence_status: completedSetups >= 10 ? "preliminary" : "insufficient_data", completed_setups: completedSetups, symbols, condition_performance: conditionPerformance, best_performing_symbols: ranked.length ? [ranked[0].symbol] : [], weakest_performing_symbols: ranked.length > 1 ? [ranked[ranked.length - 1].symbol] : [], warnings: completedSetups < 10 ? ["Insufficient completed backtest evidence."] : [], scoring_foundation: { technical_score: "existing", historical_evidence_score: "nullable_from_completed_backtests", risk_score: "future", market_condition_score: conditionPerformance.status === "available" ? "research_only" : null, final_confidence_score: "future" } };
};

const getConditionPerformance = async ({ strategyId, symbol }) => {
  const result = await pool.query(`SELECT br.symbol,br.strategy_version_id,sv.version strategy_version,br.setup_time,br.final_r,br.requires_review
    FROM backtest_results br JOIN strategy_versions sv ON sv.id=br.strategy_version_id
    WHERE br.final_r IS NOT NULL AND ($1::bigint IS NULL OR br.strategy_version_id=$1) AND ($2::text IS NULL OR br.symbol=$2)
    ORDER BY br.symbol,br.setup_time`, [strategyId, symbol]);
  if (!result.rows.length) return { status: "insufficient_data", groups: [], reason: "No completed backtest results can be linked to stored-candle conditions." };
  const groups = new Map();
  for (const row of result.rows) {
    const research = await lab.getConditions({ symbol: row.symbol, timeframe: "H1", date_to: row.setup_time });
    const condition = research.market_condition.condition;
    if (condition === "insufficient_data") continue;
    const key = `${row.symbol}:${row.strategy_version_id}:${condition}`;
    if (!groups.has(key)) groups.set(key, { symbol: row.symbol, strategy_version: row.strategy_version, market_condition: condition, setups_found: 0, completed_setups: 0, wins: 0, total_r: 0, requires_review_count: 0 });
    const group = groups.get(key); group.setups_found += 1; group.completed_setups += 1; group.total_r += Number(row.final_r); group.wins += Number(row.final_r) > 0 ? 1 : 0; group.requires_review_count += row.requires_review ? 1 : 0;
  }
  const summarized = [...groups.values()].map((group) => {
    const averageR = round(group.total_r / group.completed_setups, 4), enough = group.completed_setups >= 10;
    return { ...group, win_rate: round(group.wins * 100 / group.completed_setups, 2), average_r: averageR, total_r: round(group.total_r, 4), recommendation: !enough ? "insufficient_data" : averageR > 0 ? "promising" : "needs_adjustment", reason: !enough ? `Only ${group.completed_setups} linked completed setups; at least 10 are required.` : averageR > 0 ? "Positive average R in this condition with enough completed setups." : "Non-positive average R in this condition." };
  });
  return summarized.length ? { status: "available", groups: summarized } : { status: "insufficient_data", groups: [], reason: "Stored candles were insufficient at backtest setup times." };
};

module.exports = { getResearchIntelligence };
