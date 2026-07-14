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
    brokerSymbol: "BTCUSD",
  },
  XAUUSD: {
    name: "Gold / US Dollar",
    brokerSymbol: "GOLDmicro",
  },
  USDJPY: {
    name: "US Dollar / Japanese Yen",
    brokerSymbol: "USDJPY",
  },
  US500: {
    name: "US 500 Index",
    brokerSymbol: "US500Cash",
  },
  US100: {
    name: "US Tech 100 Index",
    brokerSymbol: "US100Cash",
  },
};

export const getInstrument = (symbol) =>
  INSTRUMENTS[symbol] || { name: symbol };
