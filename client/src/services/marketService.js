import api from "./api";
import { isStrategyTimeframe } from "../config/timeframes";

export const collectMarketData = async (symbol, timeframe) => {
  if (!isStrategyTimeframe(timeframe)) {
    const error = new Error(`${timeframe} is visual-only. Internal collection supports H1/H4/D1.`);
    error.code = "VISUAL_ONLY_TIMEFRAME";
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
