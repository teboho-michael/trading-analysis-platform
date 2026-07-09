const INSUFFICIENT_DATA = "insufficient_data";
const DEFAULT_VOLATILITY_WINDOW = 20;

const finite = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const round = (value, digits = 6) => finite(value) ? Number(Number(value).toFixed(digits)) : null;
const ordered = (candles = []) => [...candles].sort((a, b) => new Date(a.candle_time) - new Date(b.candle_time));

const calculateEmaSeries = (candles, period) => {
  if (!Number.isInteger(period) || period < 2 || candles.length < period) return null;
  const multiplier = 2 / (period + 1);
  const values = [];
  let ema = candles.slice(0, period).reduce((sum, candle) => sum + Number(candle.close), 0) / period;
  for (let index = 0; index < candles.length; index += 1) {
    if (index < period - 1) values.push(null);
    else if (index === period - 1) values.push(ema);
    else { ema = (Number(candles[index].close) - ema) * multiplier + ema; values.push(ema); }
  }
  return values;
};

const consecutiveSide = (candles, emas, index, side) => {
  let count = 0;
  for (let cursor = index; cursor >= 0 && finite(emas[cursor]); cursor -= 1) {
    const matches = side === "above" ? Number(candles[cursor].close) > emas[cursor] : Number(candles[cursor].close) < emas[cursor];
    if (!matches) break;
    count += 1;
  }
  return count;
};

const buildFeatureSeries = (inputCandles = [], options = {}) => {
  const candles = ordered(inputCandles).filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(finite));
  const emaPeriod = Number(options.emaPeriod || 200), volatilityWindow = Number(options.volatilityWindow || DEFAULT_VOLATILITY_WINDOW);
  const emas = calculateEmaSeries(candles, emaPeriod);
  return candles.map((candle, index) => {
    const open = Number(candle.open), high = Number(candle.high), low = Number(candle.low), close = Number(candle.close);
    const range = high - low, body = Math.abs(close - open), upperWick = high - Math.max(open, close), lowerWick = Math.min(open, close) - low;
    const recent = candles.slice(Math.max(0, index - volatilityWindow + 1), index + 1);
    const averageRange = recent.length >= volatilityWindow ? recent.reduce((sum, item) => sum + (Number(item.high) - Number(item.low)), 0) / recent.length : null;
    const ema = emas?.[index] ?? null, distance = finite(ema) && ema !== 0 ? (close - ema) / ema : null;
    const above = finite(ema) ? consecutiveSide(candles, emas, index, "above") : null;
    const below = finite(ema) ? consecutiveSide(candles, emas, index, "below") : null;
    const recentCloses = candles.slice(Math.max(0, index - 9), index + 1);
    const directionChanges = recentCloses.length < 5 ? null : recentCloses.slice(1).reduce((count, item, itemIndex) => {
      const currentMove = Math.sign(Number(item.close) - Number(recentCloses[itemIndex].close));
      const priorMove = itemIndex ? Math.sign(Number(recentCloses[itemIndex].close) - Number(recentCloses[itemIndex - 1].close)) : currentMove;
      return count + (currentMove && priorMove && currentMove !== priorMove ? 1 : 0);
    }, 0);
    const normalizedDistance = finite(distance) && finite(averageRange) && averageRange > 0 ? Math.abs(close - ema) / averageRange : null;
    return {
      candle_time: candle.candle_time,
      ema_period: emaPeriod,
      ema_200: emaPeriod === 200 && finite(ema) ? round(ema) : emaPeriod === 200 ? INSUFFICIENT_DATA : undefined,
      ema: finite(ema) ? round(ema) : INSUFFICIENT_DATA,
      distance_from_ema_200: emaPeriod === 200 && finite(distance) ? round(distance) : emaPeriod === 200 ? INSUFFICIENT_DATA : undefined,
      distance_from_ema: finite(distance) ? round(distance) : INSUFFICIENT_DATA,
      candle_body_size: round(body), upper_wick_size: round(Math.max(0, upperWick)), lower_wick_size: round(Math.max(0, lowerWick)), candle_range: round(range),
      direction: close > open ? "bullish" : close < open ? "bearish" : "neutral",
      volatility_proxy: finite(averageRange) ? round(averageRange) : INSUFFICIENT_DATA,
      range_position: range > 0 ? round((close - low) / range) : INSUFFICIENT_DATA,
      consecutive_closes_above_ema_200: emaPeriod === 200 && finite(above) ? above : emaPeriod === 200 ? INSUFFICIENT_DATA : undefined,
      consecutive_closes_below_ema_200: emaPeriod === 200 && finite(below) ? below : emaPeriod === 200 ? INSUFFICIENT_DATA : undefined,
      consecutive_closes_above_ema: finite(above) ? above : INSUFFICIENT_DATA,
      consecutive_closes_below_ema: finite(below) ? below : INSUFFICIENT_DATA,
      trend_strength_basic: finite(above) && finite(below) ? Math.min(10, Math.max(above, below)) : INSUFFICIENT_DATA,
      overextension_basic: finite(normalizedDistance) ? normalizedDistance >= 3 : INSUFFICIENT_DATA,
      normalized_ema_distance: finite(normalizedDistance) ? round(normalizedDistance) : INSUFFICIENT_DATA,
      choppy_basic: finite(directionChanges) ? directionChanges >= 5 : INSUFFICIENT_DATA,
      direction_changes_10: finite(directionChanges) ? directionChanges : INSUFFICIENT_DATA,
    };
  });
};

const calculateFeatures = (candles, options = {}) => {
  const series = buildFeatureSeries(candles, options);
  if (!series.length) return { status: INSUFFICIENT_DATA, required_candles: Number(options.emaPeriod || 200), available_candles: 0, latest: null, series: [] };
  const latest = series[series.length - 1], available = series.length, required = Math.max(Number(options.emaPeriod || 200), Number(options.volatilityWindow || DEFAULT_VOLATILITY_WINDOW));
  return { status: available >= required ? "available" : INSUFFICIENT_DATA, required_candles: required, available_candles: available, latest, series };
};

module.exports = { INSUFFICIENT_DATA, buildFeatureSeries, calculateFeatures, calculateEmaSeries };
