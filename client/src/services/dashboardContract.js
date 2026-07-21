export const normalizeDashboardPayload = (payload) => {
  if (payload?.success === false) {
    throw new Error(payload.error || payload.message || "Dashboard unavailable.");
  }

  if (Array.isArray(payload?.dashboard)) {
    return payload.dashboard;
  }

  throw new Error("Dashboard response did not include a dashboard array.");
};
