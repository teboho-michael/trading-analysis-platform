import api from "./api";

export const collectMarketData = async (symbol, timeframe) => {
  const response = await api.post("/market/collect", {
    symbol,
    timeframe,
  });

  return response.data;
};
