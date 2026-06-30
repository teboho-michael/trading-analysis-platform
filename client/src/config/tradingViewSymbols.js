export const TRADING_VIEW_SYMBOLS = {
  BTCUSD: {
    platformSymbol: "BTCUSD",
    tradingViewSymbol: "BINANCE:BTCUSDT",
    fallbackTradingViewSymbol: "COINBASE:BTCUSD",
    displayName: "Bitcoin / US Dollar",
    note: "TradingView crypto venue pricing may differ from Twelve Data.",
  },
  XAUUSD: {
    platformSymbol: "XAUUSD",
    tradingViewSymbol: "OANDA:XAUUSD",
    fallbackTradingViewSymbol: "FX_IDC:XAUUSD",
    displayName: "Gold / US Dollar",
    note: "TradingView forex/CFD pricing may differ from Twelve Data.",
  },
  USDJPY: {
    platformSymbol: "USDJPY",
    tradingViewSymbol: "OANDA:USDJPY",
    fallbackTradingViewSymbol: "FX_IDC:USDJPY",
    displayName: "US Dollar / Japanese Yen",
    note: "TradingView forex pricing may differ from Twelve Data.",
  },
  US500: {
    platformSymbol: "US500",
    tradingViewSymbol: "SP:SPX",
    fallbackTradingViewSymbol: "AMEX:SPY",
    displayName: "S&P 500",
    note: "Primary chart is the SPX index; SPY is the fallback proxy.",
  },
  US100: {
    platformSymbol: "US100",
    tradingViewSymbol: "NASDAQ:NDX",
    fallbackTradingViewSymbol: "NASDAQ:QQQ",
    displayName: "Nasdaq 100",
    note: "Primary chart is the NDX index; QQQ is the fallback proxy.",
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
