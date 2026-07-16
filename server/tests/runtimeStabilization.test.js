const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { classifyBridgeRuntime } = require("../services/bridgeRuntimeService");
const { classifyRuntimeHealth, REASON_CODES } = require("../services/runtimeHealthService");
const { runCoreRefresh } = require("../controllers/marketController");

const now = new Date("2026-07-16T12:00:00.000Z");
const bridgeRow = (heartbeatAt) => ({
  heartbeat_at: heartbeatAt,
  terminal_connected: true,
  status: "running",
});

test("recent bridge heartbeat produces healthy runtime status", () => {
  const bridge = classifyBridgeRuntime(bridgeRow("2026-07-16T11:59:50.000Z"), now);
  const health = classifyRuntimeHealth({ database: "available", bridge, tickStatus: "available", candleStatus: "available" });
  assert.equal(health.applicationStatus, "available");
  assert.deepEqual(health.reasons, []);
});

test("stale bridge heartbeat produces degraded status with an explicit reason", () => {
  const bridge = classifyBridgeRuntime(bridgeRow("2026-07-16T11:58:00.000Z"), now);
  const health = classifyRuntimeHealth({ database: "available", bridge, tickStatus: "available", candleStatus: "available" });
  assert.equal(health.applicationStatus, "degraded");
  assert.ok(health.reasons.some((reason) => reason.code === REASON_CODES.BRIDGE_HEARTBEAT_STALE));
});

const successfulDependencies = (failureSymbol = null) => ({
  getLivePrices: async (symbols) => ({ prices: symbols.map((symbol) => ({ symbol, status: "live", price: 100 })) }),
  getStoredCandleStatus: async (_symbol, timeframe) => ({ timeframe, candle_count: 300, status: "current" }),
  recalculateEmaStates: async () => [{}, {}, {}],
  saveZonesForSymbol: async (symbol) => {
    if (symbol === failureSymbol) {
      const error = new Error("isolated zone failure");
      error.code = "XX001";
      throw error;
    }
    return { zones_created: 1, zones_updated: 0, reason: null };
  },
  buildSetup: async () => ({ signal: "WAIT", stage: "WATCH", quality_score: 50, status: "waiting" }),
  recordCoreAlerts: async () => [],
});

for (const timeframe of ["H1", "H4", "D1"]) {
  test(`successful USDJPY ${timeframe} refresh returns structured success`, async () => {
    const result = await runCoreRefresh("USDJPY", timeframe, successfulDependencies());
    assert.equal(result.success, true);
    assert.equal(result.refresh_status, "completed");
    assert.ok(result.scan_completed_at);
    assert.deepEqual(result.failures, []);
  });
}

test("partial symbol failure does not block other symbols", async () => {
  const result = await runCoreRefresh(null, null, successfulDependencies("USDJPY"));
  assert.equal(result.refresh_status, "partial");
  assert.equal(result.symbols_processed, 5);
  assert.equal(result.results.length, 5);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].symbol, "USDJPY");
  assert.equal(result.failures[0].stage, "zone_write");
  assert.ok(result.results.some((item) => item.symbol !== "USDJPY" && item.setup));
});

test("frontend service preserves backend error_message", async () => {
  const modulePath = path.resolve(__dirname, "../../client/src/services/marketError.js");
  const { backendCollectionError } = await import(pathToFileURL(modulePath));
  assert.equal(
    backendCollectionError({ response: { data: { error_message: "column proximal_price is missing" } } }),
    "column proximal_price is missing",
  );
});
