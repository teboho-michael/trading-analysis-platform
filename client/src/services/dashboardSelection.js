export const selectedDashboardAsset = (dashboard, selectedSymbol) =>
  dashboard.find((asset) => asset.symbol === selectedSymbol);

export const fallbackDashboardSymbol = (dashboard, selectedSymbol) => {
  if (dashboard.length === 0) return selectedSymbol;
  if (selectedDashboardAsset(dashboard, selectedSymbol)) return selectedSymbol;
  return dashboard[0].symbol;
};
