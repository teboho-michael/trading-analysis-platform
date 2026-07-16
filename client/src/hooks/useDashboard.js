import { useEffect, useRef, useState } from "react";
import { getDashboard } from "../services/dashboardService";

export const useDashboard = () => {
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const fetchDashboard = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    dashboard,
    loading,
    error,
    refreshDashboard: fetchDashboard,
  };
};
