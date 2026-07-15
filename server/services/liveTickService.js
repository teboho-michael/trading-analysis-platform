const pool = require("../db/connection");
const { getInstrument, instrumentRegistry } = require("../market/instrumentRegistry");

const SOURCE = "mt5_broker";
const STATUS = {
  LIVE: "live",
  STALE: "stale",
  UNAVAILABLE: "unavailable",
};

const staleAfterSeconds = () => Math.max(Number(process.env.MT5_TICK_STALE_AFTER_SECONDS || 180), 30);
const futureToleranceSeconds = () => Math.max(Number(process.env.MT5_TICK_FUTURE_TOLERANCE_SECONDS || 5), 1);
const round = (value, digits = 10) => Number(Number(value).toFixed(digits));
const isPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const normalizeSymbol = (value) => String(value || "").trim().toUpperCase();

const displayPriceFrom = ({ bid, ask, last }) => {
  const numericBid = isPositive(bid) ? Number(bid) : null;
  const numericAsk = isPositive(ask) ? Number(ask) : null;
  const numericLast = isPositive(last) ? Number(last) : null;
  if (numericBid && numericAsk) return round((numericBid + numericAsk) / 2);
  if (numericLast) return numericLast;
  if (numericBid) return numericBid;
  if (numericAsk) return numericAsk;
  return null;
};

const classifyTick = (tickTime, now = new Date()) => {
  const parsed = new Date(tickTime);
  const rawAgeSeconds = Math.floor((now.getTime() - parsed.getTime()) / 1000);
  const ageSeconds = Math.max(0, rawAgeSeconds);
  if (!Number.isFinite(ageSeconds)) return { freshness: "missing", status: STATUS.UNAVAILABLE, age_seconds: null };
  if (rawAgeSeconds < -futureToleranceSeconds()) {
    return { freshness: "future_timestamp", status: STATUS.STALE, age_seconds: 0, warning: "MT5 tick timestamp is ahead of server receipt time beyond tolerance." };
  }
  if (ageSeconds > staleAfterSeconds()) return { freshness: "stale", status: STATUS.STALE, age_seconds: ageSeconds };
  return { freshness: "live", status: STATUS.LIVE, age_seconds: ageSeconds };
};

const parseEpochSeconds = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric * 1000);
};

const parseEpochMilliseconds = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric);
};

const parseBrokerFormattedTimeAsUtc = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00", fraction = "0"] = match;
  const millis = Number(fraction.padEnd(3, "0").slice(0, 3));
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), millis));
};

const normalizeTickTime = (payload, receivedAt = new Date()) => {
  const candidates = [
    parseEpochMilliseconds(payload.time_msc),
    parseEpochSeconds(payload.time),
    parseEpochSeconds(payload.tick_time_epoch),
    parseEpochMilliseconds(payload.tick_time_msc),
  ].filter(Boolean);
  if (candidates.length) return { tickTime: candidates[0], warning: null };

  const rawTickTime = payload.tick_time || payload.timestamp || payload.date_time || payload.time;
  const parsed = parseBrokerFormattedTimeAsUtc(rawTickTime) || new Date(rawTickTime);
  if (!rawTickTime || Number.isNaN(parsed.getTime())) throw new Error("Invalid MT5 tick time");

  const aheadSeconds = Math.floor((parsed.getTime() - receivedAt.getTime()) / 1000);
  if (aheadSeconds > futureToleranceSeconds()) {
    return {
      tickTime: receivedAt,
      warning: `MT5 tick timestamp was ${aheadSeconds}s ahead of server receipt time and was normalized to received_at.`,
    };
  }
  return { tickTime: parsed, warning: null };
};

const normalizeTickPayload = (payload, receivedAt = new Date()) => {
  const platformSymbol = normalizeSymbol(payload.platform_symbol || payload.symbol);
  if (!platformSymbol || !instrumentRegistry[platformSymbol]) throw new Error(`Unsupported MT5 tick symbol: ${platformSymbol || "missing"}`);
  const instrument = getInstrument(platformSymbol);
  const brokerSymbol = String(payload.broker_symbol || "").trim();
  if (brokerSymbol !== instrument.brokerSymbol) throw new Error(`Broker symbol mismatch for ${platformSymbol}: expected ${instrument.brokerSymbol}, received ${brokerSymbol || "missing"}`);
  const bid = isPositive(payload.bid) ? Number(payload.bid) : null;
  const ask = isPositive(payload.ask) ? Number(payload.ask) : null;
  const last = isPositive(payload.last) ? Number(payload.last) : null;
  const displayPrice = displayPriceFrom({ bid, ask, last });
  if (!displayPrice) throw new Error(`Invalid MT5 tick for ${platformSymbol}: bid, ask, and last are missing or non-positive`);
  const normalizedTime = normalizeTickTime(payload, receivedAt);
  return {
    platform_symbol: platformSymbol,
    broker_symbol: brokerSymbol,
    bid,
    ask,
    last,
    display_price: displayPrice,
    spread: bid && ask ? round(ask - bid) : null,
    tick_time: normalizedTime.tickTime,
    source: SOURCE,
    raw_payload: normalizedTime.warning ? { ...payload, tick_time_warning: normalizedTime.warning } : payload,
  };
};

const importTicks = async (payload) => {
  const ticks = Array.isArray(payload?.ticks) ? payload.ticks : [payload];
  const saved = [];
  const rejected = [];
  for (let index = 0; index < ticks.length; index += 1) {
    try {
      const receivedAt = new Date();
      const tick = normalizeTickPayload(ticks[index], receivedAt);
      const state = classifyTick(tick.tick_time, receivedAt);
      const result = await pool.query(
        `INSERT INTO live_ticks
         (platform_symbol,broker_symbol,bid,ask,last,display_price,spread,tick_time,freshness,status,source,raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         RETURNING *`,
        [tick.platform_symbol, tick.broker_symbol, tick.bid, tick.ask, tick.last, tick.display_price, tick.spread, tick.tick_time, state.freshness, state.status, SOURCE, JSON.stringify(tick.raw_payload)],
      );
      saved.push(result.rows[0]);
    } catch (error) {
      rejected.push({ index, reason: error.message });
    }
  }
  return { received_count: ticks.length, inserted_count: saved.length, rejected_count: rejected.length, ticks: saved, rejected, source: SOURCE };
};

const unavailableQuote = (symbol, message = "No imported MT5 tick is available") => {
  const instrument = getInstrument(symbol);
  return {
    symbol,
    platform_symbol: symbol,
    broker_symbol: instrument.brokerSymbol,
    bid: null,
    ask: null,
    last: null,
    display_price: null,
    price: null,
    spread: null,
    tick_time: null,
    received_at: null,
    freshness: "missing",
    status: STATUS.UNAVAILABLE,
    source: SOURCE,
    message,
  };
};

const mapTickRow = (row) => {
  const state = classifyTick(row.tick_time);
  return {
    symbol: row.platform_symbol,
    platform_symbol: row.platform_symbol,
    broker_symbol: row.broker_symbol,
    bid: row.bid === null ? null : Number(row.bid),
    ask: row.ask === null ? null : Number(row.ask),
    last: row.last === null ? null : Number(row.last),
    display_price: Number(row.display_price),
    price: Number(row.display_price),
    mid: Number(row.display_price),
    spread: row.spread === null ? null : Number(row.spread),
    tick_time: row.tick_time,
    timestamp: row.tick_time,
    received_at: row.received_at,
    age_seconds: state.age_seconds,
    freshness: state.freshness,
    status: state.status,
    source: SOURCE,
    provider: "XM MT5",
    marketStatus: "unknown",
    isProxy: false,
  };
};

const getLatestTicks = async (requestedSymbols) => {
  const symbols = requestedSymbols?.length ? requestedSymbols.map(normalizeSymbol) : Object.keys(instrumentRegistry);
  const unknown = symbols.filter((symbol) => !instrumentRegistry[symbol]);
  if (unknown.length) {
    const error = new Error(`UNKNOWN_INSTRUMENT: ${unknown.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  const result = await pool.query(
    `SELECT DISTINCT ON (platform_symbol) *
     FROM live_ticks
     WHERE platform_symbol = ANY($1)
     ORDER BY platform_symbol, tick_time DESC, received_at DESC`,
    [symbols],
  );
  const rowsBySymbol = new Map(result.rows.map((row) => [row.platform_symbol, row]));
  const prices = symbols.map((symbol) => rowsBySymbol.has(symbol) ? mapTickRow(rowsBySymbol.get(symbol)) : unavailableQuote(symbol));
  const errors = prices.filter((quote) => quote.status !== STATUS.LIVE).map((quote) => ({ symbol: quote.symbol, status: quote.status, error: quote.message || `MT5 tick is ${quote.status}` }));
  return { prices, errors, cacheStatus: "database", cacheTtlMs: 0 };
};

module.exports = {
  SOURCE,
  STATUS,
  classifyTick,
  displayPriceFrom,
  getLatestTicks,
  importTicks,
  normalizeTickTime,
};
