const pool = require("../db/connection");
const { getInstrument } = require("../market/instrumentRegistry");
const strategyRegistry = require("./strategyRegistryService");
const { collectCandlesForAsset } = require("../market/candleCollector");
const { MT5_SOURCE, sourceMetadataForScope, evidencePolicy } = require("./mt5EvidencePolicy");

const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const parseDate = (value, name, endOfDay = false) => {
  if (!value) throw serviceError(`${name} is required`);
  const text = String(value);
  const date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999Z` : text);
  if (Number.isNaN(date.getTime())) throw serviceError(`${name} must be a valid date`);
  return date;
};
const validateSymbol = (value) => {
  const symbol = String(value || "").toUpperCase();
  if (!symbol) throw serviceError("symbol is required");
  try { getInstrument(symbol); } catch (_error) { throw serviceError(`Unsupported symbol: ${symbol}`); }
  return symbol;
};
const validateRange = (dateFrom, dateTo) => {
  const from = parseDate(dateFrom, "date_from"), to = parseDate(dateTo, "date_to", true);
  if (to < from) throw serviceError("date_to must be on or after date_from");
  return { from, to };
};

const checkSymbolTimeframeReadiness = async ({ symbol, timeframe, date_from, date_to, minimumCandles = 201 }) => {
  const normalizedSymbol = validateSymbol(symbol), normalizedTimeframe = String(timeframe || "").toUpperCase();
  if (!normalizedTimeframe) throw serviceError("timeframe is required");
  const { from, to } = validateRange(date_from, date_to);
  const result = await pool.query(`SELECT COUNT(*)::int available,MIN(c.candle_time) earliest,MAX(c.candle_time) latest
    FROM candles c JOIN assets a ON a.id=c.asset_id
    WHERE a.symbol=$1 AND c.timeframe=$2 AND c.candle_time <= $3 AND c.source=$4`, [normalizedSymbol, normalizedTimeframe, to, MT5_SOURCE]);
  const row = result.rows[0], required = Number(minimumCandles);
  const sourceMetadata = await sourceMetadataForScope({ symbol: normalizedSymbol, timeframe: normalizedTimeframe, dateTo: to });
  const ready = row.available >= required;
  return {
    timeframe: normalizedTimeframe,
    required,
    available: row.available,
    ready,
    status: ready ? "ready" : "missing_mt5_data",
    missing_reason: ready ? null : "insufficient_data",
    earliest: row.earliest,
    latest: row.latest,
    requested_date_from: from,
    requested_date_to: to,
    ...sourceMetadata,
  };
};

const checkStrategyReadiness = async ({ strategy_version_id, symbol, date_from, date_to }) => {
  if (!Number.isInteger(Number(strategy_version_id)) || Number(strategy_version_id) <= 0) throw serviceError("strategy_version_id must be a positive integer");
  const strategy = await strategyRegistry.getStrategyVersion(strategy_version_id);
  if (!strategy) throw serviceError("Strategy version not found", 404);
  const normalizedSymbol = validateSymbol(symbol);
  validateRange(date_from, date_to);
  const requirements = strategyRegistry.getRequiredTimeframes(strategy);
  if (!requirements.length) throw serviceError("This strategy version does not declare required timeframes");
  const requiredTimeframes = await Promise.all(requirements.map(async (requirement) => ({
    ...(await checkSymbolTimeframeReadiness({ symbol: normalizedSymbol, timeframe: requirement.timeframe, date_from, date_to, minimumCandles: requirement.minimumCandles })),
    role: requirement.role,
  })));
  const missing = requiredTimeframes.filter((item) => !item.ready).map((item) => item.timeframe);
  const metadata = await sourceMetadataForScope({ symbol: normalizedSymbol });
  return { symbol: normalizedSymbol, strategy_version_id: Number(strategy_version_id), ready: missing.length === 0, status: missing.length === 0 ? "ready" : "missing_mt5_data", required_timeframes: requiredTimeframes, missing_timeframes: missing, ...metadata, ...evidencePolicy() };
};

const collectRequiredData = async (input = {}) => {
  const before = await checkStrategyReadiness(input);
  const statuses = [];
  for (const item of before.required_timeframes) {
    if (item.ready) { statuses.push({ timeframe: item.timeframe, status: "already_ready", available: item.available, required: item.required }); continue; }
    try {
      const collection = await collectCandlesForAsset(before.symbol, item.timeframe);
      const after = await checkSymbolTimeframeReadiness({ symbol: before.symbol, timeframe: item.timeframe, date_from: input.date_from, date_to: input.date_to, minimumCandles: item.required });
      statuses.push({ timeframe: item.timeframe, status: after.ready ? "collected" : "partially_collected", candles_saved: collection.candlesSaved, available: after.available, required: after.required });
    } catch (error) {
      const mapped = error.message?.includes("MT5_BRIDGE_ERROR") ? "awaiting_mt5_candles" : "failed";
      statuses.push({ timeframe: item.timeframe, status: mapped, available: item.available, required: item.required, message: error.message, provider_code: error.code || null });
    }
  }
  return { symbol: before.symbol, strategy_version_id: before.strategy_version_id, collection_statuses: statuses, readiness: await checkStrategyReadiness(input) };
};

module.exports = { checkSymbolTimeframeReadiness, checkStrategyReadiness, collectRequiredData, validateRange, validateSymbol };
