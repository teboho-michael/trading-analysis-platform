const { getInstrument } = require("../market/instrumentRegistry");

const STOP_BUFFER_PERCENT = 0.001; // 0.1%

const getAccountBalance = () => {
  return Number(process.env.ACCOUNT_BALANCE || 10000);
};

const getRiskPercent = () => {
  return Number(process.env.RISK_PERCENT || 1);
};

const roundPrice = (price, instrument) => {
  const tickSize = Number(instrument.tickSize);
  const normalizedPrice = tickSize > 0
    ? Math.round(Number(price) / tickSize) * tickSize
    : Number(price);

  return Number(normalizedPrice.toFixed(instrument.priceDecimals));
};

const calculatePositionSize = (symbol, riskAmount) => {
  const instrument = getInstrument(symbol);

  const accountBalance = getAccountBalance();
  const riskPercent = getRiskPercent();
  const accountRiskAmount = accountBalance * (riskPercent / 100);

  if (!riskAmount || riskAmount <= 0) {
    return {
      accountBalance,
      riskPercent,
      accountRiskAmount: Number(accountRiskAmount.toFixed(2)),
      positionSizeUnits: null,
      positionSizeLots: null,
      positionSizeNote: "Invalid risk amount",
    };
  }

  const positionSizeUnits = accountRiskAmount / riskAmount;

  let positionSizeLots = null;

  if (instrument.contractSize && instrument.contractSize > 1) {
    positionSizeLots = positionSizeUnits / instrument.contractSize;
  }

  return {
    accountBalance,
    riskPercent,
    accountRiskAmount: Number(accountRiskAmount.toFixed(2)),
    positionSizeUnits: Number(positionSizeUnits.toFixed(6)),
    positionSizeLots:
      positionSizeLots !== null ? Number(positionSizeLots.toFixed(6)) : null,
    positionSizeNote: instrument.note,
    assetSpec: {
      priceDecimals: instrument.priceDecimals,
      pipSize: instrument.pipSize,
      tickSize: instrument.tickSize,
      contractSize: instrument.contractSize,
      sizingMode: instrument.sizingMode,
      priceScaleMode: instrument.priceScaleMode,
      assetClass: instrument.assetClass,
      brokerSymbolFuture: instrument.brokerSymbolFuture,
      brokerSymbol: instrument.brokerSymbol,
      priceRange: instrument.priceRange,
    },
  };
};

const calculateBuyRisk = (symbol, entryPrice, zone) => {
  const instrument = getInstrument(symbol);

  const zoneLow = Number(zone.zone_low);
  const stopBuffer = entryPrice * STOP_BUFFER_PERCENT;

  const stopLoss = zoneLow - stopBuffer;
  const riskAmount = entryPrice - stopLoss;

  if (riskAmount <= 0) {
    return null;
  }

  const takeProfit1 = entryPrice + riskAmount * 2;
  const takeProfit2 = entryPrice + riskAmount * 3;

  const position = calculatePositionSize(symbol, riskAmount);

  return {
    entryPrice: roundPrice(entryPrice, instrument),
    stopLoss: roundPrice(stopLoss, instrument),
    takeProfit1: roundPrice(takeProfit1, instrument),
    takeProfit2: roundPrice(takeProfit2, instrument),
    riskAmount: roundPrice(riskAmount, instrument),
    riskReward1: "1:2",
    riskReward2: "1:3",
    stopBasis: "Below demand zone low",
    ...position,
  };
};

const calculateSellRisk = (symbol, entryPrice, zone) => {
  const instrument = getInstrument(symbol);

  const zoneHigh = Number(zone.zone_high);
  const stopBuffer = entryPrice * STOP_BUFFER_PERCENT;

  const stopLoss = zoneHigh + stopBuffer;
  const riskAmount = stopLoss - entryPrice;

  if (riskAmount <= 0) {
    return null;
  }

  const takeProfit1 = entryPrice - riskAmount * 2;
  const takeProfit2 = entryPrice - riskAmount * 3;

  const position = calculatePositionSize(symbol, riskAmount);

  return {
    entryPrice: roundPrice(entryPrice, instrument),
    stopLoss: roundPrice(stopLoss, instrument),
    takeProfit1: roundPrice(takeProfit1, instrument),
    takeProfit2: roundPrice(takeProfit2, instrument),
    riskAmount: roundPrice(riskAmount, instrument),
    riskReward1: "1:2",
    riskReward2: "1:3",
    stopBasis: "Above supply zone high",
    ...position,
  };
};

const calculateRiskLevels = (symbol, signal, latestPrice, activeZone) => {
  if (!signal || signal === "WAIT") return null;
  if (!latestPrice || !activeZone) return null;

  const entryPrice = Number(latestPrice);

  if (signal === "BUY SETUP") {
    if (activeZone.zone_type !== "demand") return null;
    return calculateBuyRisk(symbol, entryPrice, activeZone);
  }

  if (signal === "SELL SETUP") {
    if (activeZone.zone_type !== "supply") return null;
    return calculateSellRisk(symbol, entryPrice, activeZone);
  }

  return null;
};

module.exports = {
  calculateRiskLevels,
};
