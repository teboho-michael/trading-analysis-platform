export const backendCollectionError = (error) => error.response?.data?.error_message
  || error.response?.data?.error
  || error.response?.data?.message
  || error.message
  || "Failed to collect market data.";
