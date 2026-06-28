const { calculateEMA } = require("./emaEngine");

const calculateTrendFromCandles = (candles, period = 200) => {
  const requiredCandles = period + 1;

  if (!candles || candles.length < requiredCandles) {
    return {
      success: false,
      trend: "Insufficient Data",
      requiredCandles,
      availableCandles: candles ? candles.length : 0,
    };
  }

  const sortedCandles = [...candles].sort(
    (a, b) => new Date(a.candle_time) - new Date(b.candle_time),
  );

  const previousEma200 = calculateEMA(sortedCandles.slice(0, -1), period);
  const ema200 = calculateEMA(sortedCandles, period);

  const previousClose = Number(sortedCandles[sortedCandles.length - 2].close);
  const lastClose = Number(sortedCandles[sortedCandles.length - 1].close);

  let trend = "Neutral";

  if (previousClose > previousEma200 && lastClose > ema200) {
    trend = "Bullish";
  } else if (previousClose < previousEma200 && lastClose < ema200) {
    trend = "Bearish";
  }

  return {
    success: true,
    ema200,
    previousEma200,
    previousClose,
    lastClose,
    trend,
  };
};

module.exports = {
  calculateTrendFromCandles,
};
