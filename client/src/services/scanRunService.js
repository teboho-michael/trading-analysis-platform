import api from "./api";

export const getLatestScanRun = async () => {
  const response = await api.get("/scan-runs/latest");
  return response.data.latestScanRun;
};

export const getScanRuns = async () => {
  const response = await api.get("/scan-runs");
  return response.data.scanRuns;
};
