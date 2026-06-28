export const WATCHLIST_ORDER = [
  "BTCUSD",
  "XAUUSD",
  "USDJPY",
  "US500",
  "US100",
];

export const INSTRUMENTS = {
  BTCUSD: {
    name: "Bitcoin / US Dollar",
  },
  XAUUSD: {
    name: "Gold / US Dollar",
  },
  USDJPY: {
    name: "US Dollar / Japanese Yen",
  },
  US500: {
    name: "S&P 500",
    proxySymbol: "SPY",
    proxyNote:
      "The current provider mapping uses SPY ETF candles. Actual S&P 500 cash-index data is not available in this feed.",
  },
  US100: {
    name: "Nasdaq 100",
    proxySymbol: "QQQ",
    proxyNote:
      "The current provider mapping uses QQQ ETF candles. Actual Nasdaq 100 cash-index data is not available in this feed.",
  },
};

export const getInstrument = (symbol) =>
  INSTRUMENTS[symbol] || { name: symbol };
