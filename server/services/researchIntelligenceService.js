const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");
const strategyRegistry = require("./strategyRegistryService");

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
  return { strategy_version_id: strategyId, symbol: normalizedSymbol, overall_status: completedSetups >= 10 ? "evidence_available" : "insufficient_data", evidence_status: completedSetups >= 10 ? "preliminary" : "insufficient_data", completed_setups: completedSetups, symbols, best_performing_symbols: ranked.length ? [ranked[0].symbol] : [], weakest_performing_symbols: ranked.length > 1 ? [ranked[ranked.length - 1].symbol] : [], warnings: completedSetups < 10 ? ["Insufficient completed backtest evidence."] : [], scoring_foundation: { technical_score: "existing", historical_evidence_score: "nullable_from_completed_backtests", risk_score: "future", market_condition_score: "future", final_confidence_score: "future" } };
};

module.exports = { getResearchIntelligence };
