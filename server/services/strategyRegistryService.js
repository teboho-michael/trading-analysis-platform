const pool = require("../db/connection");

const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });

const DEFAULT_REQUIRED_TIMEFRAMES = [
  { timeframe: "D1", role: "bias_context", minimumCandles: 201 },
  { timeframe: "H4", role: "zone_context", minimumCandles: 201 },
  { timeframe: "H1", role: "execution_confirmation", minimumCandles: 201 },
];

const getRequiredTimeframes = (strategyVersion) => {
  if (!strategyVersion || strategyVersion.strategy_key !== "supply_demand_ema_200") return [];
  const configured = strategyVersion.rules_json?.required_timeframes;
  if (!Array.isArray(configured) || !configured.length) return DEFAULT_REQUIRED_TIMEFRAMES.map((item) => ({ ...item }));
  return configured.map((item) => ({
    timeframe: String(item.timeframe || "").toUpperCase(),
    role: item.role || "strategy_context",
    minimumCandles: Number(item.minimumCandles || item.minimum_candles || 201),
  }));
};

const listStrategyVersions = async () => {
  const result = await pool.query("SELECT * FROM strategy_versions ORDER BY strategy_key, created_at DESC, id DESC");
  return result.rows;
};

const getStrategyVersion = async (id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw validationError("strategy id must be a positive integer");
  const result = await pool.query("SELECT * FROM strategy_versions WHERE id=$1", [Number(id)]);
  return result.rows[0] || null;
};

const getActiveStrategyVersion = async (strategyKey) => {
  if (!strategyKey) throw validationError("strategy_key is required");
  const result = await pool.query("SELECT * FROM strategy_versions WHERE strategy_key=$1 AND is_active=TRUE ORDER BY created_at DESC, id DESC LIMIT 1", [strategyKey]);
  return result.rows[0] || null;
};

const createStrategyVersion = async (payload = {}) => {
  const required = ["strategy_key", "strategy_name", "version", "timeframe_primary"];
  for (const key of required) if (!payload[key]) throw validationError(`${key} is required`);
  const result = await pool.query(`INSERT INTO strategy_versions
    (strategy_key,strategy_name,version,description,rules_json,timeframe_primary,timeframe_confirmation,is_active)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`, [
    payload.strategy_key, payload.strategy_name, payload.version, payload.description || null,
    JSON.stringify(payload.rules_json || {}), payload.timeframe_primary, payload.timeframe_confirmation || null, Boolean(payload.is_active),
  ]);
  return result.rows[0];
};

const exposeCurrentStrategyConfig = (strategyVersion) => ({
  ...strategyVersion,
  implementation: strategyVersion?.strategy_key === "supply_demand_ema_200" ? "supply_demand_ema_200_v1" : null,
  required_timeframes: getRequiredTimeframes(strategyVersion),
});

module.exports = { listStrategyVersions, getStrategyVersion, getActiveStrategyVersion, createStrategyVersion, exposeCurrentStrategyConfig, getRequiredTimeframes };
