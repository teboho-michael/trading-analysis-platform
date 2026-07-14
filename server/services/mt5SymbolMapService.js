const MT5_SYMBOL_MAP = Object.freeze({
  BTCUSD: ["BTCUSD"],
  XAUUSD: ["GOLDmicro"],
  USDJPY: ["USDJPY"],
  US500: ["US500Cash"],
  US100: ["US100Cash"],
});

const getSymbolMap = () => ({
  source: "mt5_broker",
  configurable: false,
  status: "authoritative",
  note: "V5.2 uses the confirmed XM MT5 broker symbols as the active platform mapping.",
  symbols: MT5_SYMBOL_MAP,
});

module.exports = {
  MT5_SYMBOL_MAP,
  getSymbolMap,
};
