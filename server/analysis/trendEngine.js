const { calculateEMA } = require("./emaEngine");

const calculateTrendFromCandles = (candles, period = 200) => {
  if (!candles || candles.length < period) {
    return {
      success: false,
      trend: "Insufficient Data",
      availableCandles: candles ? candles.length : 0,
    };
  }

  const sortedCandles = [...candles].sort(
    (a, b) => new Date(a.candle_time) - new Date(b.candle_time),
  );

  const ema200 = calculateEMA(sortedCandles, period);

  const previousClose = Number(sortedCandles[sortedCandles.length - 2].close);
  const lastClose = Number(sortedCandles[sortedCandles.length - 1].close);

  let trend = "Neutral";

  if (previousClose > ema200 && lastClose > ema200) {
    trend = "Bullish";
  } else if (previousClose < ema200 && lastClose < ema200) {
    trend = "Bearish";
  }

  return {
    success: true,
    ema200,
    previousClose,
    lastClose,
    trend,
  };
};

module.exports = {
  calculateTrendFromCandles,
};
