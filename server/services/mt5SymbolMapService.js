const MT5_SYMBOL_MAP = Object.freeze({
  BTCUSD: ["BTCUSD", "BTCUSD.", "BTCUSDm"],
  XAUUSD: ["XAUUSD", "GOLD", "XAUUSD.", "XAUUSDm"],
  USDJPY: ["USDJPY", "USDJPYm", "USDJPY."],
  US500: ["US500Cash", "US500", "SP500", "US500m"],
  US100: ["US100Cash", "US100", "NAS100", "USTEC", "US100m"],
});

const getSymbolMap = () => ({
  source: "mt5_broker",
  configurable: true,
  status: "foundation_only",
  note: "Candidate broker symbols are server-side defaults for the Windows MT5 bridge and may need broker-account-specific tuning.",
  symbols: MT5_SYMBOL_MAP,
});

module.exports = {
  MT5_SYMBOL_MAP,
  getSymbolMap,
};
