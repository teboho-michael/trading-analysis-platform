import api from "./api";
import { asArray } from "./arrays";

export const getLatestScanRun = async () => {
  const response = await api.get("/scan-runs/latest");
  return response.data.latestScanRun;
};

export const getScanRuns = async () => {
  const response = await api.get("/scan-runs");
  return asArray(response.data.scanRuns);
};
