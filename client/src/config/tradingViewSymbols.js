export const TRADING_VIEW_SYMBOLS = {
  BTCUSD: {
    platformSymbol: "BTCUSD",
    tradingViewSymbol: "BINANCE:BTCUSDT",
    fallbackTradingViewSymbol: "COINBASE:BTCUSD",
    displayName: "Bitcoin / US Dollar",
    note: "TradingView crypto venue pricing is visual only; research uses MT5 broker candles.",
  },
  XAUUSD: {
    platformSymbol: "XAUUSD",
    tradingViewSymbol: "OANDA:XAUUSD",
    fallbackTradingViewSymbol: "FX_IDC:XAUUSD",
    displayName: "Gold / US Dollar",
    note: "TradingView forex/CFD pricing is visual only; research uses MT5 broker candles.",
  },
  USDJPY: {
    platformSymbol: "USDJPY",
    tradingViewSymbol: "OANDA:USDJPY",
    fallbackTradingViewSymbol: "FX_IDC:USDJPY",
    displayName: "US Dollar / Japanese Yen",
    note: "TradingView forex pricing is visual only; research uses MT5 broker candles.",
  },
  US500: {
    platformSymbol: "US500",
    tradingViewSymbol: "OANDA:SPX500USD",
    fallbackTradingViewSymbol: "SP:SPX",
    displayName: "US 500 Index",
    note: "Direct index/CFD-style charting; analysis uses direct index-scale data when available.",
  },
  US100: {
    platformSymbol: "US100",
    tradingViewSymbol: "OANDA:NAS100USD",
    fallbackTradingViewSymbol: "NASDAQ:NDX",
    displayName: "US Tech 100 Index",
    note: "Direct index/CFD-style charting; analysis uses direct index-scale data when available.",
  },
};

export const TRADING_VIEW_INTERVALS = {
  M1: "1",
  M5: "5",
  M15: "15",
  H1: "60",
  H4: "240",
  D1: "D",
};

export const getTradingViewInstrument = (platformSymbol) =>
  TRADING_VIEW_SYMBOLS[platformSymbol] || TRADING_VIEW_SYMBOLS.BTCUSD;

export const getTradingViewInterval = (timeframe) =>
  TRADING_VIEW_INTERVALS[timeframe] || TRADING_VIEW_INTERVALS.H1;
