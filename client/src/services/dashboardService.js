import api from "./api";
import { normalizeDashboardPayload } from "./dashboardContract";

export const getDashboard = async () => {
  const response = await api.get("/dashboard");
  return normalizeDashboardPayload(response.data);
};
