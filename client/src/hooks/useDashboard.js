import { useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "../services/apiErrors";
import { getDashboard } from "../services/dashboardService";
import {
  dashboardLoadFailed,
  dashboardLoadSucceeded,
  initialDashboardState,
} from "../services/dashboardState";

export const useDashboard = () => {
  const [state, setState] = useState(initialDashboardState);
  const inFlight = useRef(false);

  const fetchDashboard = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await getDashboard();
      setState((current) => dashboardLoadSucceeded(current, data));
    } catch (error) {
      setState((current) =>
        dashboardLoadFailed(
          current,
          apiErrorMessage(error, "Unable to load dashboard data."),
        ),
      );
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    dashboard: state.dashboard,
    loading: state.loading,
    error: state.error,
    refreshDashboard: fetchDashboard,
  };
};
