import api from "./api";

const normalizeCandlesForChart = (candles) => {
  const candleMap = new Map();

  candles.forEach((candle) => {
    const timeInSeconds = Math.floor(
      new Date(candle.candle_time).getTime() / 1000,
    );

    candleMap.set(timeInSeconds, {
      ...candle,
      chart_time: timeInSeconds,
    });
  });

  return Array.from(candleMap.values()).sort(
    (a, b) => a.chart_time - b.chart_time,
  );
};

export const getCandles = async (symbol, timeframe) => {
  const response = await api.get(`/candles/${symbol}/${timeframe}`);

  return normalizeCandlesForChart(response.data.candles);
};
