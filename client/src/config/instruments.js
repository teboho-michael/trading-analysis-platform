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
    name: "US 500 Index",
  },
  US100: {
    name: "US Tech 100 Index",
  },
};

export const getInstrument = (symbol) =>
  INSTRUMENTS[symbol] || { name: symbol };
