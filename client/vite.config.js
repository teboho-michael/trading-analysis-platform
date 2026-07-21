import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export const API_PROXY_TARGET = "http://127.0.0.1:5000";
export const API_PROXY_PATH = "/api";
export const PREVIEW_HOST = "0.0.0.0";
export const PREVIEW_PORT = 4173;

export const createApiProxyConfig = () => ({
  [API_PROXY_PATH]: {
    target: API_PROXY_TARGET,
    changeOrigin: false,
  },
});

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: createApiProxyConfig(),
  },
  preview: {
    host: PREVIEW_HOST,
    port: PREVIEW_PORT,
    strictPort: true,
    proxy: createApiProxyConfig(),
  },
});
