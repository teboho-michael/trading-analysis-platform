const calculateEMA = (candles, period = 200) => {
  if (!candles || candles.length < period) {
    return null;
  }

  const sortedCandles = [...candles].sort(
    (a, b) => new Date(a.candle_time) - new Date(b.candle_time),
  );

  const closes = sortedCandles.map((candle) => Number(candle.close));

  const multiplier = 2 / (period + 1);

  let ema =
    closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(8));
};

module.exports = {
  calculateEMA,
};
