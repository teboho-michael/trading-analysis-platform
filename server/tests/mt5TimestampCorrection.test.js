const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../db/connection");
const {
  BRIDGE_NAME,
  classifyBridgeRuntime,
  recordHeartbeat,
  utcTimestamp,
} = require("../services/bridgeRuntimeService");
const {
  classifyTick,
  getLatestTicks,
  importTicks,
} = require("../services/liveTickService");
const { classifyRuntimeHealth } = require("../services/runtimeHealthService");

const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

const heartbeatPayload = (heartbeatAt = new Date().toISOString()) => ({
  process_id: 4321,
  host_name: "vps-mt5",
  started_at: "2026-07-16T08:00:00.000Z",
  heartbeat_at: heartbeatAt,
  last_tick_import_at: heartbeatAt,
  last_candle_sync_at: heartbeatAt,
  broker_offset_seconds: 10800,
  terminal_connected: true,
  status: "running",
  details: { mode: "continuous" },
});

test("valid ISO Z heartbeat binds timestamptz values and repeated calls upsert one bridge row", async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ bridge_name: values[0], heartbeat_at: values[4], terminal_connected: true, status: "running" }] };
  };
  const payload = heartbeatPayload();
  const first = await recordHeartbeat(payload);
  const second = await recordHeartbeat({ ...payload, process_id: 4322 });
  assert.equal(first.bridge_name, BRIDGE_NAME);
  assert.equal(second.bridge_name, BRIDGE_NAME);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /\$4::timestamptz/);
  assert.match(calls[0].sql, /ON CONFLICT \(bridge_name\) DO UPDATE/);
  assert.ok(calls[0].values[3] instanceof Date);
  assert.ok(calls[0].values[4] instanceof Date);
  assert.equal(calls[0].values[0], calls[1].values[0]);
});

test("invalid heartbeat timestamp is a structured validation failure", () => {
  assert.throws(
    () => utcTimestamp("not-a-time", "heartbeat_at"),
    (error) => error.statusCode === 400
      && error.details?.field === "heartbeat_at"
      && error.details?.code === "INVALID_UTC_TIMESTAMP",
  );
});

test("new tick insert uses an absolute UTC instant and database receipt time", async () => {
  let insert;
  pool.query = async (sql, values) => {
    if (sql.includes("INSERT INTO live_ticks")) {
      insert = { sql, values };
      return { rows: [{ platform_symbol: values[0], tick_time: values[7], received_at: new Date(), utc_storage_valid: true }] };
    }
    return { rows: [] };
  };
  const now = Date.now();
  const result = await importTicks({
    platform_symbol: "USDJPY",
    broker_symbol: "USDJPY",
    bid: 155.1,
    ask: 155.12,
    tick_time: new Date(now - 1000).toISOString(),
    clock_offset_seconds: 10800,
  });
  assert.equal(result.inserted_count, 1);
  assert.match(insert.sql, /\$8::timestamptz/);
  assert.match(insert.sql, /CURRENT_TIMESTAMP,TRUE/);
  assert.ok(insert.values[7] instanceof Date);
  assert.match(insert.values[7].toISOString(), /Z$/);
});

test("near-zero absolute tick latency is live and seven-hour skew is not live", () => {
  const near = classifyTick("2026-07-16T12:00:00.000Z", "2026-07-16T12:00:01.000Z", new Date("2026-07-16T12:00:02.000Z"));
  const contaminated = classifyTick("2026-07-16T05:00:00.000Z", "2026-07-16T12:00:00.000Z", new Date("2026-07-16T12:00:01.000Z"));
  assert.equal(near.status, "live");
  assert.notEqual(contaminated.status, "live");
  assert.equal(contaminated.is_fresh, false);
  assert.equal(contaminated.clock_skew_seconds, -25200);
});

test("future received_at keeps its negative age and is invalid", () => {
  const state = classifyTick("2026-07-16T12:04:59.000Z", "2026-07-16T12:05:00.000Z", new Date("2026-07-16T12:00:00.000Z"));
  assert.equal(state.status, "stale");
  assert.equal(state.freshness, "future_receipt");
  assert.equal(state.received_age_seconds, -300);
});

test("latest selection requires corrected rows and returns one valid tick per symbol", async () => {
  let selectionSql;
  const now = new Date();
  pool.query = async (sql) => {
    selectionSql = sql;
    return { rows: [{
      platform_symbol: "USDJPY", broker_symbol: "USDJPY", bid: "155.1", ask: "155.12", last: null,
      display_price: "155.11", spread: "0.02", tick_time: new Date(now - 1000), received_at: now,
      source: "mt5_broker", utc_storage_valid: true,
    }] };
  };
  const result = await getLatestTicks(["USDJPY"]);
  assert.equal(result.prices.length, 1);
  assert.equal(result.prices[0].status, "live");
  assert.match(selectionSql, /utc_storage_valid = TRUE/);
  assert.match(selectionSql, /ABS\(EXTRACT\(EPOCH FROM \(received_at - tick_time\)\)\)/);
});

test("health is available with a recent heartbeat and five valid fresh ticks, but stale heartbeat degrades it", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");
  const recent = classifyBridgeRuntime({ heartbeat_at: "2026-07-16T11:59:50.000Z", terminal_connected: true, status: "running" }, now);
  const ticks = Array.from({ length: 5 }, () => classifyTick("2026-07-16T11:59:59.000Z", "2026-07-16T12:00:00.000Z", now));
  const tickStatus = ticks.every((tick) => tick.status === "live" && tick.is_fresh) ? "available" : "unavailable";
  assert.equal(classifyRuntimeHealth({ database: "available", bridge: recent, tickStatus, candleStatus: "available" }).applicationStatus, "available");
  const stale = classifyBridgeRuntime({ heartbeat_at: "2026-07-16T11:58:00.000Z", terminal_connected: true, status: "running" }, now);
  assert.equal(classifyRuntimeHealth({ database: "available", bridge: stale, tickStatus, candleStatus: "available" }).applicationStatus, "degraded");
});
