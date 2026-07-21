import assert from "node:assert/strict";
import test from "node:test";
import viteConfig, {
  API_PROXY_PATH,
  API_PROXY_TARGET,
  PREVIEW_HOST,
  createApiProxyConfig,
} from "../../vite.config.js";
import {
  confirmationChecklistFor,
  hasRiskObject,
  signalLabelFor,
} from "./analysisDisplay.js";
import { normalizeDashboardPayload } from "./dashboardContract.js";
import {
  DEFAULT_DEVELOPMENT_API_BASE_URL,
  DEFAULT_PRODUCTION_API_BASE_URL,
  resolveApiBaseUrl,
} from "./apiConfig.js";
import {
  dashboardLoadFailed,
  dashboardLoadSucceeded,
  initialDashboardState,
} from "./dashboardState.js";
import {
  fallbackDashboardSymbol,
  selectedDashboardAsset,
} from "./dashboardSelection.js";

test("normalizes dashboard arrays from the API response", () => {
  const dashboard = [{ symbol: "BTCUSD" }];

  assert.deepEqual(
    normalizeDashboardPayload({ success: true, dashboard }),
    dashboard,
  );
});

test("keeps an empty dashboard array as a renderable unavailable state", () => {
  assert.deepEqual(
    normalizeDashboardPayload({ success: true, dashboard: [] }),
    [],
  );
});

test("rejects missing dashboard arrays before App can call dashboard.find", () => {
  assert.throws(
    () => normalizeDashboardPayload({ success: true }),
    /dashboard array/,
  );
});

test("rejects non-array dashboard fields before App can call dashboard.find", () => {
  assert.throws(
    () => normalizeDashboardPayload({ success: true, dashboard: {} }),
    /dashboard array/,
  );
});

test("rejects HTML responses before App can call dashboard.find", () => {
  assert.throws(
    () => normalizeDashboardPayload("<!doctype html><html></html>"),
    /dashboard array/,
  );
});

test("rejects malformed objects before App can call dashboard.find", () => {
  assert.throws(
    () => normalizeDashboardPayload({ dashboard: null }),
    /dashboard array/,
  );
});

test("surfaces API failure details instead of returning undefined", () => {
  assert.throws(
    () => normalizeDashboardPayload({ success: false, error: "schema drift" }),
    /schema drift/,
  );
});

test("uses same-origin API routing in development", () => {
  assert.equal(
    resolveApiBaseUrl({ DEV: true, PROD: false }),
    DEFAULT_DEVELOPMENT_API_BASE_URL,
  );
});

test("uses same-origin API routing in production preview builds", () => {
  assert.equal(
    resolveApiBaseUrl({ DEV: false, PROD: true }),
    DEFAULT_PRODUCTION_API_BASE_URL,
  );
});

test("does not let browser-side VITE_API_BASE_URL bypass same-origin routing", () => {
  assert.equal(
    resolveApiBaseUrl({
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "http://example.invalid/api/",
    }),
    "/api",
  );
});

test("configures the Vite dev proxy to the internal backend", () => {
  assert.equal(viteConfig.server.proxy[API_PROXY_PATH].target, API_PROXY_TARGET);
});

test("configures the Vite preview proxy to the internal backend", () => {
  assert.equal(viteConfig.preview.proxy[API_PROXY_PATH].target, API_PROXY_TARGET);
});

test("preserves the proxied API path", () => {
  const proxy = createApiProxyConfig()[API_PROXY_PATH];

  assert.equal(proxy.rewrite, undefined);
  assert.equal(API_PROXY_PATH, "/api");
});

test("binds Vite preview for private network and Tailscale access", () => {
  assert.equal(viteConfig.preview.host, PREVIEW_HOST);
  assert.equal(PREVIEW_HOST, "0.0.0.0");
});

test("initial dashboard state is always an array", () => {
  assert.deepEqual(initialDashboardState.dashboard, []);
});

test("successful dashboard loads keep dashboard state as an array", () => {
  const next = dashboardLoadSucceeded(initialDashboardState, [{ symbol: "BTCUSD" }]);

  assert.deepEqual(next.dashboard, [{ symbol: "BTCUSD" }]);
  assert.equal(next.loading, false);
  assert.equal(next.error, "");
});

test("refresh failure preserves existing dashboard data", () => {
  const current = dashboardLoadSucceeded(initialDashboardState, [{ symbol: "BTCUSD" }]);
  const next = dashboardLoadFailed(current, "proxy failed");

  assert.deepEqual(next.dashboard, [{ symbol: "BTCUSD" }]);
  assert.equal(next.loading, false);
  assert.equal(next.error, "proxy failed");
});

test("selected symbol uses the active dashboard row when available", () => {
  const dashboard = [{ symbol: "BTCUSD" }, { symbol: "US500" }];

  assert.deepEqual(selectedDashboardAsset(dashboard, "US500"), { symbol: "US500" });
  assert.equal(fallbackDashboardSymbol(dashboard, "US500"), "US500");
});

test("selected symbol falls back when the previous symbol disappears", () => {
  const dashboard = [{ symbol: "XAUUSD" }, { symbol: "USDJPY" }];

  assert.equal(fallbackDashboardSymbol(dashboard, "BTCUSD"), "XAUUSD");
});

test("selected symbol is unchanged for an empty dashboard", () => {
  assert.equal(fallbackDashboardSymbol([], "BTCUSD"), "BTCUSD");
});

test("no-signal and no-risk display contracts are explicit", () => {
  const asset = { symbol: "BTCUSD", confirmationChecklist: {} };

  assert.equal(signalLabelFor(asset), "None");
  assert.equal(hasRiskObject(asset), false);
  assert.deepEqual(confirmationChecklistFor(asset), []);
});
