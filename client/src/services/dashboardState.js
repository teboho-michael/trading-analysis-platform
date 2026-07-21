export const initialDashboardState = {
  dashboard: [],
  loading: true,
  error: "",
};

export const dashboardLoadSucceeded = (state, dashboard) => ({
  ...state,
  dashboard,
  loading: false,
  error: "",
});

export const dashboardLoadFailed = (state, error) => ({
  ...state,
  dashboard: Array.isArray(state.dashboard) ? state.dashboard : [],
  loading: false,
  error,
});
