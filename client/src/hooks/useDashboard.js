import { useEffect, useState } from "react";
import { getDashboard } from "../services/dashboardService";

export const useDashboard = () => {
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const data = await getDashboard();
      setDashboard(data);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    dashboard,
    loading,
    refreshDashboard: fetchDashboard,
  };
};
