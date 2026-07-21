import axios from "axios";
import { resolveApiBaseUrl } from "./apiConfig";

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env);

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;
