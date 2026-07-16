import api from "./api";

const normalizeCandlesForChart = (candles, symbol, timeframe) => {
  const candleMap = new Map();

  candles.forEach((candle) => {
    const timestamp = new Date(candle.candle_time || candle.time).getTime();
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const volume = Number(candle.volume);

    if (
      !Number.isFinite(timestamp) ||
      ![open, high, low, close].every(Number.isFinite)
    ) {
      return;
    }

    const timeInSeconds = Math.floor(timestamp / 1000);

    candleMap.set(timeInSeconds, {
      ...candle,
      symbol,
      timeframe,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
      candle_time: new Date(timestamp).toISOString(),
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
    response.data.platform_symbol !== symbol ||
    response.data.timeframe !== timeframe
  ) {
    throw new Error(
      `Candle response mismatch: requested ${symbol} ${timeframe}`,
    );
  }

  const responseCandles = response.data.forming_candle
    ? [...response.data.candles, { ...response.data.forming_candle, isForming: true }]
    : response.data.candles;
  return {
    candles: normalizeCandlesForChart(responseCandles, symbol, timeframe),
    metadata: {
      symbol: response.data.platform_symbol,
      brokerSymbol: response.data.broker_symbol,
      timeframe: response.data.timeframe,
      source: response.data.source,
      dataSource: response.data.data_source,
      sourcePurity: response.data.source_purity,
      candleCount: response.data.candle_count,
      earliestCandleTime: response.data.earliest_candle_time,
      latestCandleTime: response.data.latest_candle_time,
      latestStoredCandleTime: response.data.latest_stored_candle_time,
      latestClosedCandleTime: response.data.latest_closed_candle_time,
      formingCandlePresent: response.data.forming_candle_present,
      formingCandleTime: response.data.forming_candle_time,
      formingCandle: response.data.forming_candle,
      nextExpectedCloseTime: response.data.next_expected_close_time,
      freshness: response.data.freshness,
      reason: response.data.reason,
      candleAgeSeconds: response.data.candle_age_seconds,
      staleThresholdSeconds: response.data.stale_threshold_seconds,
    },
  };
};
