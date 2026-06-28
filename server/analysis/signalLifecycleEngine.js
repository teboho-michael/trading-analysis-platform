const toNumber = (value) => Number(value);

const evaluateBuySignal = (signal, candle) => {
  const candleHigh = toNumber(candle.high);
  const candleLow = toNumber(candle.low);

  const stopLoss = toNumber(signal.stop_loss);
  const takeProfit1 = toNumber(signal.take_profit_1);
  const takeProfit2 = toNumber(signal.take_profit_2);

  if (candleLow <= stopLoss) {
    return {
      status: "closed",
      outcome: "Stop loss hit",
      outcomeReason: "STOP_LOSS_HIT",
      exitPrice: stopLoss,
    };
  }

  if (candleHigh >= takeProfit2) {
    return {
      status: "closed",
      outcome: "Take profit 2 hit",
      outcomeReason: "TAKE_PROFIT_2_HIT",
      exitPrice: takeProfit2,
    };
  }

  if (candleHigh >= takeProfit1) {
    return {
      status: "closed",
      outcome: "Take profit 1 hit",
      outcomeReason: "TAKE_PROFIT_1_HIT",
      exitPrice: takeProfit1,
    };
  }

  return {
    status: "active",
    outcome: "Signal still active",
    outcomeReason: null,
    exitPrice: null,
  };
};

const evaluateSellSignal = (signal, candle) => {
  const candleHigh = toNumber(candle.high);
  const candleLow = toNumber(candle.low);

  const stopLoss = toNumber(signal.stop_loss);
  const takeProfit1 = toNumber(signal.take_profit_1);
  const takeProfit2 = toNumber(signal.take_profit_2);

  if (candleHigh >= stopLoss) {
    return {
      status: "closed",
      outcome: "Stop loss hit",
      outcomeReason: "STOP_LOSS_HIT",
      exitPrice: stopLoss,
    };
  }

  if (candleLow <= takeProfit2) {
    return {
      status: "closed",
      outcome: "Take profit 2 hit",
      outcomeReason: "TAKE_PROFIT_2_HIT",
      exitPrice: takeProfit2,
    };
  }

  if (candleLow <= takeProfit1) {
    return {
      status: "closed",
      outcome: "Take profit 1 hit",
      outcomeReason: "TAKE_PROFIT_1_HIT",
      exitPrice: takeProfit1,
    };
  }

  return {
    status: "active",
    outcome: "Signal still active",
    outcomeReason: null,
    exitPrice: null,
  };
};

const evaluateSignalLifecycle = (signal, latestCandle) => {
  if (!signal || !latestCandle) {
    return {
      status: "active",
      outcome: "No candle available for evaluation",
      outcomeReason: null,
      exitPrice: null,
    };
  }

  if (signal.signal_type === "BUY") {
    return evaluateBuySignal(signal, latestCandle);
  }

  if (signal.signal_type === "SELL") {
    return evaluateSellSignal(signal, latestCandle);
  }

  return {
    status: "active",
    outcome: "Unknown signal type",
    outcomeReason: null,
    exitPrice: null,
  };
};

module.exports = {
  evaluateSignalLifecycle,
};
