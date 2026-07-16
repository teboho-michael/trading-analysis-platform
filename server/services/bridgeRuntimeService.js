const pool = require("../db/connection");

const BRIDGE_NAME = "mt5-continuous-bridge";
const HEARTBEAT_MAX_AGE_SECONDS = 20;

const utcTimestamp = (value, field, fallback = null) => {
  const timestamp = value == null ? fallback : new Date(value);
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    const error = new Error(`Invalid ${field} UTC timestamp`);
    error.statusCode = 400;
    error.details = { field, code: "INVALID_UTC_TIMESTAMP" };
    throw error;
  }
  return timestamp;
};

const classifyBridgeRuntime = (row, now = new Date()) => {
  if (!row) return { status: "unavailable", process_count: 0, heartbeat_age_seconds: null };
  const age = Math.max(0, Math.floor((now - new Date(row.heartbeat_at)) / 1000));
  const available = age <= HEARTBEAT_MAX_AGE_SECONDS && row.terminal_connected && row.status === "running";
  // This is heartbeat evidence for the one authoritative bridge_name, not a
  // Windows process enumeration. The VPS health script verifies the OS count.
  return { ...row, status: available ? "available" : "stale", process_count: available ? 1 : 0, heartbeat_age_seconds: age };
};

const recordHeartbeat = async (payload = {}) => {
  const now = new Date();
  const heartbeat = utcTimestamp(payload.heartbeat_at, "heartbeat_at", now);
  if (Math.abs(now.getTime() - heartbeat.getTime()) > 120000) {
    const error = new Error("Invalid continuous bridge heartbeat time"); error.statusCode = 400; throw error;
  }
  const startedAt = utcTimestamp(payload.started_at, "started_at", heartbeat);
  const lastTickImportAt = payload.last_tick_import_at ? utcTimestamp(payload.last_tick_import_at, "last_tick_import_at") : null;
  const lastCandleSyncAt = payload.last_candle_sync_at ? utcTimestamp(payload.last_candle_sync_at, "last_candle_sync_at") : null;
  const result = await pool.query(
    `INSERT INTO bridge_runtime_state
      (bridge_name,process_id,host_name,started_at,heartbeat_at,broker_offset_seconds,terminal_connected,last_tick_import_at,last_candle_sync_at,status,details,updated_at)
     VALUES ($1,$2,$3,COALESCE($4::timestamptz,$5::timestamptz),$5::timestamptz,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11::jsonb,CURRENT_TIMESTAMP)
     ON CONFLICT (bridge_name) DO UPDATE SET process_id=EXCLUDED.process_id,host_name=EXCLUDED.host_name,
       started_at=EXCLUDED.started_at,heartbeat_at=EXCLUDED.heartbeat_at,broker_offset_seconds=EXCLUDED.broker_offset_seconds,
       terminal_connected=EXCLUDED.terminal_connected,last_tick_import_at=COALESCE(EXCLUDED.last_tick_import_at,bridge_runtime_state.last_tick_import_at),
       last_candle_sync_at=COALESCE(EXCLUDED.last_candle_sync_at,bridge_runtime_state.last_candle_sync_at),status=EXCLUDED.status,
       details=EXCLUDED.details,updated_at=CURRENT_TIMESTAMP RETURNING *`,
    [BRIDGE_NAME, payload.process_id || null, payload.host_name || null, startedAt, heartbeat,
      Number(payload.broker_offset_seconds || 0), payload.terminal_connected === true, lastTickImportAt,
      lastCandleSyncAt, payload.status || "running", JSON.stringify(payload.details || {})],
  );
  return result.rows[0];
};

const getBridgeRuntime = async (now = new Date()) => {
  const result = await pool.query("SELECT * FROM bridge_runtime_state WHERE bridge_name=$1", [BRIDGE_NAME]);
  const row = result.rows[0];
  return classifyBridgeRuntime(row, now);
};

module.exports = { BRIDGE_NAME, HEARTBEAT_MAX_AGE_SECONDS, classifyBridgeRuntime, recordHeartbeat, getBridgeRuntime, utcTimestamp };
