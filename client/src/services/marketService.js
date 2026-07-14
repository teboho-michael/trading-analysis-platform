import api from "./api";
import { isStrategyTimeframe } from "../config/timeframes";

export const collectMarketData = async (symbol, timeframe) => {
  if (!isStrategyTimeframe(timeframe)) {
    const error = new Error(`${timeframe} is not supported. MT5 candle collection supports D1/H4/H1.`);
    error.code = "UNSUPPORTED_TIMEFRAME";
    throw error;
  }
  const response = await api.post("/market/collect", {
    symbol,
    timeframe,
  });

  return response.data;
};

export const runMarketScan = async () => {
  const response = await api.post("/market/scan");

  return response.data;
};
