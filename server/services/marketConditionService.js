const { INSUFFICIENT_DATA } = require("./featureEngineeringService");

const available = (value) => value !== INSUFFICIENT_DATA && value !== null && value !== undefined;

const classifyMarketCondition = ({ symbol, timeframe, feature } = {}) => {
  const base = { symbol, timeframe, date_time: feature?.candle_time || null };
  if (!feature || !available(feature.distance_from_ema) || !available(feature.volatility_proxy) || !available(feature.trend_strength_basic) || !available(feature.choppy_basic)) {
    return { ...base, condition: INSUFFICIENT_DATA, confidence: null, reason: "At least 200 stored candles plus a complete volatility window are required." };
  }
  const distance = Number(feature.distance_from_ema), streak = Math.max(Number(feature.consecutive_closes_above_ema || 0), Number(feature.consecutive_closes_below_ema || 0));
  const above = Number(feature.consecutive_closes_above_ema || 0), below = Number(feature.consecutive_closes_below_ema || 0), extended = feature.overextension_basic === true;
  if (extended && distance > 0) return { ...base, condition: "overextended_bullish", confidence: streak >= 5 ? "high" : "medium", reason: "Price is more than three average candle ranges above EMA 200." };
  if (extended && distance < 0) return { ...base, condition: "overextended_bearish", confidence: streak >= 5 ? "high" : "medium", reason: "Price is more than three average candle ranges below EMA 200." };
  if (feature.choppy_basic && Math.abs(distance) < 0.01) return { ...base, condition: "sideways_choppy", confidence: "medium", reason: "Recent closes frequently alternate direction while price remains near EMA 200." };
  if (above >= 3 && feature.direction === "bearish" && Number(feature.range_position) < 0.5) return { ...base, condition: "pullback_in_bullish_trend", confidence: "medium", reason: "The established closes-above-EMA sequence is retracing with a bearish candle." };
  if (below >= 3 && feature.direction === "bullish" && Number(feature.range_position) > 0.5) return { ...base, condition: "pullback_in_bearish_trend", confidence: "medium", reason: "The established closes-below-EMA sequence is retracing with a bullish candle." };
  if (streak >= 5 && Number(feature.candle_range) >= Number(feature.volatility_proxy) * 1.5 && ((distance > 0 && feature.range_position >= 0.75) || (distance < 0 && feature.range_position <= 0.25))) return { ...base, condition: "breakout_candidate", confidence: "medium", reason: "A sustained EMA-side sequence ended with an expanded-range candle near its directional extreme." };
  if (above >= 3) return { ...base, condition: "bullish_trend", confidence: above >= 8 ? "high" : "medium", reason: `Price has closed above EMA 200 for ${above} consecutive candles.` };
  if (below >= 3) return { ...base, condition: "bearish_trend", confidence: below >= 8 ? "high" : "medium", reason: `Price has closed below EMA 200 for ${below} consecutive candles.` };
  if (Math.abs(Number(feature.normalized_ema_distance)) >= 2) return { ...base, condition: "mean_reversion_risk", confidence: "low", reason: "Price is at least two average candle ranges from EMA 200 without a sustained directional sequence." };
  return { ...base, condition: "sideways_choppy", confidence: "low", reason: "No sustained EMA-side sequence or directional expansion is present." };
};

const classifyTrendVsMeanReversion = ({ symbol, timeframe, feature, condition, date_from = null, date_to = null } = {}) => {
  const base = { symbol, timeframe, date_range: { date_from, date_to } };
  if (!condition || condition.condition === INSUFFICIENT_DATA) return { ...base, dominant_behavior: INSUFFICIENT_DATA, reason: "Stored feature evidence is insufficient.", recommendation: "Collect more stored candles before comparing behavior." };
  if (["bullish_trend", "bearish_trend", "pullback_in_bullish_trend", "pullback_in_bearish_trend", "breakout_candidate"].includes(condition.condition)) return { ...base, dominant_behavior: "trend_following", reason: condition.reason, recommendation: "Research trend-following strategy results for this condition; this is not a trade instruction." };
  if (["overextended_bullish", "overextended_bearish", "mean_reversion_risk"].includes(condition.condition)) return { ...base, dominant_behavior: "mean_reversion", reason: condition.reason, recommendation: "Research mean-reversion outcomes and reversal risk; this is not a trade instruction." };
  return { ...base, dominant_behavior: "avoid_choppy", reason: condition.reason, recommendation: "Treat this range as a choppy-market research cohort." };
};

module.exports = { classifyMarketCondition, classifyTrendVsMeanReversion };
