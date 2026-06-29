import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardService";

export const useDashboard = () => {
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    try {
      setError("");
      const data = await getDashboard();
      setDashboard(data);
    } catch (error) {
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    dashboard,
    loading,
    error,
    refreshDashboard: fetchDashboard,
  };
};
