export const DEFAULT_DEVELOPMENT_API_BASE_URL = "/api";
export const DEFAULT_PRODUCTION_API_BASE_URL = "/api";

export const resolveApiBaseUrl = (env = {}) => {
  return env.PROD
    ? DEFAULT_PRODUCTION_API_BASE_URL
    : DEFAULT_DEVELOPMENT_API_BASE_URL;
};
