import api from "./api";

const normalizeCandlesForChart = (candles, symbol, timeframe) => {
  const candleMap = new Map();

  candles.forEach((candle) => {
    if (candle.symbol !== symbol || candle.timeframe !== timeframe) {
      throw new Error(
        `Candle identity mismatch: requested ${symbol} ${timeframe}, received ${candle.symbol} ${candle.timeframe}`,
      );
    }

    const timestamp = new Date(candle.candle_time).getTime();
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    if (
      !Number.isFinite(timestamp) ||
      ![open, high, low, close].every(Number.isFinite)
    ) {
      return;
    }

    const timeInSeconds = Math.floor(timestamp / 1000);

    candleMap.set(timeInSeconds, {
      ...candle,
      open,
      high,
      low,
      close,
      chart_time: timeInSeconds,
    });
  });

  return Array.from(candleMap.values()).sort(
    (a, b) => a.chart_time - b.chart_time,
  );
};

export const getCandles = async (symbol, timeframe) => {
  const response = await api.get(`/candles/${symbol}/${timeframe}`);

  if (
    response.data.symbol !== symbol ||
    response.data.timeframe !== timeframe
  ) {
    throw new Error(
      `Candle response mismatch: requested ${symbol} ${timeframe}`,
    );
  }

  return normalizeCandlesForChart(response.data.candles, symbol, timeframe);
};
