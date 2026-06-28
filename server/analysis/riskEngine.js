const { getAssetSpec } = require("../market/assetSpecs");

const STOP_BUFFER_PERCENT = 0.001; // 0.1%

const getAccountBalance = () => {
  return Number(process.env.ACCOUNT_BALANCE || 10000);
};

const getRiskPercent = () => {
  return Number(process.env.RISK_PERCENT || 1);
};

const roundPrice = (price, decimals) => {
  return Number(Number(price).toFixed(decimals));
};

const calculatePositionSize = (symbol, riskAmount) => {
  const spec = getAssetSpec(symbol);

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

  if (spec.contractSize && spec.contractSize > 1) {
    positionSizeLots = positionSizeUnits / spec.contractSize;
  }

  return {
    accountBalance,
    riskPercent,
    accountRiskAmount: Number(accountRiskAmount.toFixed(2)),
    positionSizeUnits: Number(positionSizeUnits.toFixed(6)),
    positionSizeLots:
      positionSizeLots !== null ? Number(positionSizeLots.toFixed(6)) : null,
    positionSizeNote: spec.note,
    assetSpec: {
      pipSize: spec.pipSize,
      contractSize: spec.contractSize,
      sizingMode: spec.sizingMode,
    },
  };
};

const calculateBuyRisk = (symbol, entryPrice, zone) => {
  const spec = getAssetSpec(symbol);
  const decimals = spec.priceDecimals;

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
    entryPrice: roundPrice(entryPrice, decimals),
    stopLoss: roundPrice(stopLoss, decimals),
    takeProfit1: roundPrice(takeProfit1, decimals),
    takeProfit2: roundPrice(takeProfit2, decimals),
    riskAmount: roundPrice(riskAmount, decimals),
    riskReward1: "1:2",
    riskReward2: "1:3",
    stopBasis: "Below demand zone low",
    ...position,
  };
};

const calculateSellRisk = (symbol, entryPrice, zone) => {
  const spec = getAssetSpec(symbol);
  const decimals = spec.priceDecimals;

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
    entryPrice: roundPrice(entryPrice, decimals),
    stopLoss: roundPrice(stopLoss, decimals),
    takeProfit1: roundPrice(takeProfit1, decimals),
    takeProfit2: roundPrice(takeProfit2, decimals),
    riskAmount: roundPrice(riskAmount, decimals),
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
