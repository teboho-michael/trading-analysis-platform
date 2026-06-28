const { getProviderSymbol } = require("../symbolMap");

const getTimeframeMinutes = (timeframe) => {
  switch (timeframe) {
    case "D1":
      return 1440;
    case "H4":
      return 240;
    case "H1":
    default:
      return 60;
  }
};

const getBasePrice = (symbol) => {
  switch (symbol) {
    case "US500":
      return 550;
    case "US100":
      return 500;
    case "XAUUSD":
      return 3350;
    case "BTCUSD":
      return 107000;
    case "USDJPY":
      return 145;
    default:
      return 1000;
  }
};

const getCandles = async (symbol, timeframe) => {
  const candles = [];
  const basePrice = getBasePrice(symbol);
  const timeframeMinutes = getTimeframeMinutes(timeframe);

  const now = new Date();

  for (let i = 4; i >= 0; i--) {
    const candleTime = new Date(
      now.getTime() - i * timeframeMinutes * 60 * 1000,
    );

    const open = basePrice + (4 - i) * 2;
    const close = open + 5;
    const high = close + 3;
    const low = open - 3;

    candles.push({
      open,
      high,
      low,
      close,
      volume: 1000 + i,
      candle_time: candleTime,
      source_symbol: getProviderSymbol(symbol),
    });
  }

  return candles;
};

module.exports = {
  getCandles,
};
