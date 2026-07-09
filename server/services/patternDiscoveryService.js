const { INSUFFICIENT_DATA } = require("./featureEngineeringService");

const discoverPatterns = ({ symbol, timeframe, feature, condition, linked_strategy_key = null } = {}) => {
  const base = { symbol, timeframe, date_time: feature?.candle_time || null, linked_strategy_key };
  if (!feature || !condition || condition.condition === INSUFFICIENT_DATA) return [{ ...base, pattern_label: INSUFFICIENT_DATA, confidence: null, features_used: [], reason: "Pattern rules require complete EMA and volatility features." }];
  const map = {
    bullish_trend: ["trend_continuation_candidate", ["consecutive_closes_above_ema", "distance_from_ema"]],
    bearish_trend: ["trend_continuation_candidate", ["consecutive_closes_below_ema", "distance_from_ema"]],
    pullback_in_bullish_trend: ["pullback_candidate", ["consecutive_closes_above_ema", "direction", "range_position"]],
    pullback_in_bearish_trend: ["pullback_candidate", ["consecutive_closes_below_ema", "direction", "range_position"]],
    overextended_bullish: ["overextension_warning", ["normalized_ema_distance", "volatility_proxy"]],
    overextended_bearish: ["overextension_warning", ["normalized_ema_distance", "volatility_proxy"]],
    mean_reversion_risk: ["mean_reversion_candidate", ["normalized_ema_distance", "trend_strength_basic"]],
    sideways_choppy: ["choppy_market_warning", ["direction_changes_10", "distance_from_ema"]],
    breakout_candidate: ["breakout_retest_candidate", ["candle_range", "volatility_proxy", "range_position"]],
  };
  const selected = map[condition.condition];
  if (!selected) return [{ ...base, pattern_label: INSUFFICIENT_DATA, confidence: null, features_used: [], reason: "No deterministic pattern rule matched." }];
  return [{ ...base, pattern_label: selected[0], confidence: condition.confidence, features_used: selected[1], reason: condition.reason }];
};

module.exports = { discoverPatterns };
