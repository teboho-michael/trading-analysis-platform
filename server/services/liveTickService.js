const pool = require("../db/connection");
const { getInstrument, instrumentRegistry } = require("../market/instrumentRegistry");
const { resolveOpenAlerts } = require("./alertService");

const SOURCE = "mt5_broker";
const STATUS = {
  LIVE: "live",
  STALE: "stale",
  UNAVAILABLE: "unavailable",
};

const staleAfterSeconds = () => Math.max(Number(process.env.MT5_TICK_STALE_AFTER_SECONDS || 180), 30);
const skewToleranceSeconds = () => Math.max(Number(process.env.MT5_TICK_SKEW_TOLERANCE_SECONDS || process.env.MT5_TICK_FUTURE_TOLERANCE_SECONDS || 60), 5);
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

const classifyTick = (tickTime, receivedAt = new Date(), now = new Date()) => {
  const parsed = new Date(tickTime);
  const received = new Date(receivedAt);
  const eventAgeSeconds = Math.floor((now.getTime() - parsed.getTime()) / 1000);
  const receivedAgeSeconds = Math.floor((now.getTime() - received.getTime()) / 1000);
  const clockSkewSeconds = Math.floor((parsed.getTime() - received.getTime()) / 1000);
  if (![eventAgeSeconds, receivedAgeSeconds, clockSkewSeconds].every(Number.isFinite)) {
    return { freshness: "missing", status: STATUS.UNAVAILABLE, is_fresh: false, age_seconds: null, received_age_seconds: null, clock_skew_seconds: null };
  }
  const safeEventAge = Math.max(0, eventAgeSeconds);
  const safeReceivedAge = Math.max(0, receivedAgeSeconds);
  if (clockSkewSeconds > skewToleranceSeconds()) {
    return {
      freshness: "future_timestamp",
      status: STATUS.STALE,
      is_fresh: false,
      age_seconds: safeEventAge,
      received_age_seconds: safeReceivedAge,
      clock_skew_seconds: clockSkewSeconds,
      warning: "MT5 tick timestamp is ahead of receipt time beyond tolerance.",
    };
  }
  if (safeReceivedAge > staleAfterSeconds()) {
    return { freshness: "stale", status: STATUS.STALE, is_fresh: false, age_seconds: safeEventAge, received_age_seconds: safeReceivedAge, clock_skew_seconds: clockSkewSeconds };
  }
  return { freshness: "live", status: STATUS.LIVE, is_fresh: true, age_seconds: safeEventAge, received_age_seconds: safeReceivedAge, clock_skew_seconds: clockSkewSeconds };
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
    parseEpochMilliseconds(payload.tick_time_msc),
    parseEpochSeconds(payload.time),
    parseEpochSeconds(payload.tick_time_epoch),
  ].filter(Boolean);
  if (candidates.length) return { tickTime: candidates[0], warning: null };

  const rawTickTime = payload.tick_time || payload.timestamp || payload.date_time || payload.time;
  const parsed = parseBrokerFormattedTimeAsUtc(rawTickTime) || new Date(rawTickTime);
  if (!rawTickTime || Number.isNaN(parsed.getTime())) throw new Error("Invalid MT5 tick time");

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
      const state = classifyTick(tick.tick_time, receivedAt, receivedAt);
      const result = await pool.query(
        `INSERT INTO live_ticks
         (platform_symbol,broker_symbol,bid,ask,last,display_price,spread,tick_time,freshness,status,source,raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         RETURNING *`,
        [tick.platform_symbol, tick.broker_symbol, tick.bid, tick.ask, tick.last, tick.display_price, tick.spread, tick.tick_time, state.freshness, state.status, SOURCE, JSON.stringify(tick.raw_payload)],
      );
      const savedTick = result.rows[0];
      saved.push(savedTick);
      if (state.status === STATUS.LIVE && state.is_fresh === true) {
        await resolveOpenAlerts({ symbol: tick.platform_symbol, alertType: "data_stale", reason: "Fresh MT5 tick imported" });
      }
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
    is_fresh: false,
    age_seconds: null,
    received_age_seconds: null,
    clock_skew_seconds: null,
    source: SOURCE,
    message,
  };
};

const mapTickRow = (row) => {
  const state = classifyTick(row.tick_time, row.received_at);
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
    received_age_seconds: state.received_age_seconds,
    clock_skew_seconds: state.clock_skew_seconds,
    freshness: state.freshness,
    status: state.status,
    is_fresh: state.is_fresh,
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
    `WITH requested AS (
       SELECT *
       FROM unnest($1::text[], $2::text[]) AS item(platform_symbol, broker_symbol)
     )
     SELECT lt.*
     FROM requested r
     JOIN LATERAL (
       SELECT *
       FROM live_ticks
       WHERE platform_symbol = r.platform_symbol
         AND broker_symbol = r.broker_symbol
         AND source = $3
         AND received_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
       ORDER BY
         CASE
           WHEN received_at >= CURRENT_TIMESTAMP - ($4::int * INTERVAL '1 second')
            AND tick_time <= received_at + ($5::int * INTERVAL '1 second')
           THEN 0
           ELSE 1
         END,
         received_at DESC,
         tick_time DESC
       LIMIT 25
     ) lt ON TRUE
     ORDER BY r.platform_symbol, lt.received_at DESC, lt.tick_time DESC`,
    [symbols, symbols.map((symbol) => getInstrument(symbol).brokerSymbol), SOURCE, staleAfterSeconds(), skewToleranceSeconds()],
  );
  const rowsBySymbol = new Map();
  for (const row of result.rows) {
    if (!rowsBySymbol.has(row.platform_symbol)) rowsBySymbol.set(row.platform_symbol, []);
    rowsBySymbol.get(row.platform_symbol).push(row);
  }
  const prices = symbols.map((symbol) => {
    const rows = rowsBySymbol.get(symbol) || [];
    const mapped = rows.map(mapTickRow);
    return mapped.find((quote) => quote.status === STATUS.LIVE && quote.is_fresh) || mapped[0] || unavailableQuote(symbol);
  });
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
