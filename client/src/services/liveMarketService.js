import api from "./api";

export const getLivePrices = async (symbols) => {
  const response = await api.get("/live/prices", { params: symbols?.length ? { symbols: symbols.join(",") } : undefined });
  return response.data;
};
