const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateEmaStateFromCandles } = require("../services/coreEmaService");
const { detectH4Zones, classifyZone } = require("../services/coreZoneService");
const { displayPriceFrom, classifyTick, normalizeTickTime } = require("../services/liveTickService");
const { acceptedLivePrice, nearZone } = require("../services/coreSetupService");
const { classifyCandleFreshness } = require("../services/mt5MarketMetadataService");
const { buildAlertDedupeKey } = require("../services/alertService");
const { calculateRiskLevels } = require("../analysis/riskEngine");

const candles = (count, start = 100) => Array.from({ length: count }, (_, index) => ({
  open: start + index,
  high: start + index + 1,
  low: start + index - 1,
  close: start + index,
  candle_time: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
}));

const flatH4 = (count, price = 100) => Array.from({ length: count }, (_, index) => ({
  open: price + (index % 2 ? 0.05 : -0.05),
  high: price + 0.6,
  low: price - 0.6,
  close: price + (index % 2 ? -0.05 : 0.05),
  candle_time: new Date(Date.UTC(2026, 0, 1, index * 4)).toISOString(),
}));

const injectDemand = (series, start = 24) => {
  series[start] = { ...series[start], open: 100.1, high: 100.45, low: 99.8, close: 100.2 };
  series[start + 1] = { ...series[start + 1], open: 100.2, high: 100.5, low: 99.9, close: 100.05 };
  series[start + 2] = { ...series[start + 2], open: 100.05, high: 100.35, low: 99.85, close: 100.25 };
  series[start + 3] = { ...series[start + 3], open: 100.3, high: 104.8, low: 100.1, close: 104.3 };
  series[start + 4] = { ...series[start + 4], open: 104.3, high: 105.1, low: 103.8, close: 104.6 };
  return series;
};

const injectSupply = (series, start = 24) => {
  series[start] = { ...series[start], open: 100.2, high: 100.55, low: 99.9, close: 100.1 };
  series[start + 1] = { ...series[start + 1], open: 100.1, high: 100.45, low: 99.8, close: 100.25 };
  series[start + 2] = { ...series[start + 2], open: 100.25, high: 100.5, low: 99.85, close: 100.05 };
  series[start + 3] = { ...series[start + 3], open: 100.0, high: 100.2, low: 95.5, close: 96.0 };
  series[start + 4] = { ...series[start + 4], open: 96.0, high: 96.3, low: 95.1, close: 95.7 };
  return series;
};

test("live tick display price uses bid/ask midpoint first", () => {
  assert.equal(displayPriceFrom({ bid: 100, ask: 102, last: 99 }), 101);
  assert.equal(displayPriceFrom({ bid: null, ask: null, last: 99 }), 99);
  assert.equal(displayPriceFrom({ bid: 100, ask: null, last: null }), 100);
});

test("tick classification separates live and stale using receipt time", () => {
  assert.equal(classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T00:00:02.000Z")).status, "live");
  assert.equal(classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T01:00:00.000Z")).status, "stale");
});

test("EMA 200 uses closed candle set and returns bullish state", () => {
  const state = calculateEmaStateFromCandles("BTCUSD", "H1", candles(220, 100));
  assert.equal(state.trend_state, "bullish");
  assert.equal(state.price_above_ema, true);
  assert.ok(state.ema_200 > 0);
});

test("EMA 200 reports insufficient data", () => {
  const state = calculateEmaStateFromCandles("BTCUSD", "H1", candles(20, 100));
  assert.equal(state.trend_state, "insufficient_data");
  assert.equal(state.ema_200, null);
});

test("H4 zone detector finds demand after compact base and departure", () => {
  const series = injectDemand(flatH4(50));
  const detected = detectH4Zones(series);
  const demand = detected.zones.find((zone) => zone.zone_type === "demand");
  assert.ok(demand);
  assert.ok(demand.proximal_price > demand.distal_price);
  assert.equal(demand.source_time, demand.origin_time);
});

test("H4 zone detector finds supply after compact base and bearish departure", () => {
  const detected = detectH4Zones(injectSupply(flatH4(50)));
  const supply = detected.zones.find((zone) => zone.zone_type === "supply");
  assert.ok(supply);
  assert.ok(supply.proximal_price < supply.distal_price);
});

test("H4 zone detector rejects weak departure", () => {
  const series = flatH4(50);
  series[24] = { ...series[24], open: 100.1, high: 100.4, low: 99.8, close: 100.2 };
  series[25] = { ...series[25], open: 100.2, high: 100.5, low: 99.9, close: 100.1 };
  series[26] = { ...series[26], open: 100.2, high: 100.9, low: 100.0, close: 100.7 };
  const detected = detectH4Zones(series);
  assert.equal(detected.zones.length, 0);
  assert.match(detected.reason, /weak_departure|no_clean_base_departure_found/);
});

test("H4 zone detector rejects malformed or overly wide zone", () => {
  const series = flatH4(50);
  series[24] = { ...series[24], open: 100, high: 115, low: 85, close: 101 };
  series[25] = { ...series[25], open: 101, high: 116, low: 84, close: 100 };
  series[26] = { ...series[26], open: 100, high: 125, low: 99, close: 124 };
  const detected = detectH4Zones(series);
  assert.equal(detected.zones.length, 0);
});

test("zone invalidation breaks demand after decisive close below", () => {
  const zone = { zone_type: "demand", zone_high: 110, zone_low: 100, distal_price: 100 };
  const state = classifyZone(zone, 98, 105);
  assert.equal(state.status, "broken");
});

test("demand zone survives touch/retest", () => {
  const zone = { zone_type: "demand", zone_high: 110, zone_low: 100, distal_price: 100 };
  const state = classifyZone(zone, 112, 105);
  assert.equal(state.status, "tested");
  assert.equal(state.retested, true);
});

test("supply zone breaks after decisive close above distal boundary", () => {
  const zone = { zone_type: "supply", zone_high: 110, zone_low: 100, distal_price: 110 };
  assert.equal(classifyZone(zone, 112, 104).status, "broken");
});

test("setup proximity requires live price near or inside zone", () => {
  const zone = { zone_high: 110, zone_low: 100 };
  assert.equal(nearZone(105, zone).inside, true);
  assert.equal(nearZone(200, zone).near, false);
});

test("zone proximity distance is mathematically correct above below and at boundaries", () => {
  const zone = { zone_high: 110, zone_low: 100 };
  assert.deepEqual(
    { inside: nearZone(100, zone).inside, distance: nearZone(100, zone).distance },
    { inside: true, distance: 0 },
  );
  assert.equal(nearZone(110, zone).distance, 0);
  assert.equal(nearZone(115, zone).distance, 5);
  assert.equal(nearZone(95, zone).distance, 5);
  assert.equal(nearZone(null, zone).distance, null);
  assert.equal(nearZone(65000, { zone_high: 66000, zone_low: 64000 }).inside, true);
  assert.equal(nearZone(157.25, { zone_high: 158, zone_low: 156 }).inside, true);
  assert.ok(Number.isFinite(nearZone(115, zone).threshold));
});

test("setup live price accepts only fresh MT5 tick prices", () => {
  assert.equal(acceptedLivePrice({ status: "live", freshness: "live", is_fresh: true, display_price: 123.45 }).price, 123.45);
  assert.equal(acceptedLivePrice({ status: "stale", freshness: "future_timestamp", is_fresh: false, display_price: 123.45 }).price, null);
});

test("risk levels produce valid 2R and 3R targets for demand and supply", () => {
  const buy = calculateRiskLevels("XAUUSD", "BUY SETUP", 100, { zone_type: "demand", zone_low: 99, zone_high: 101 });
  assert.ok(buy.stopLoss < buy.entryPrice);
  assert.equal(Number(((buy.takeProfit1 - buy.entryPrice) / buy.riskAmount).toFixed(0)), 2);
  assert.equal(Number(((buy.takeProfit2 - buy.entryPrice) / buy.riskAmount).toFixed(0)), 3);

  const sell = calculateRiskLevels("XAUUSD", "SELL SETUP", 100, { zone_type: "supply", zone_low: 99, zone_high: 101 });
  assert.ok(sell.stopLoss > sell.entryPrice);
  assert.equal(Number(((sell.entryPrice - sell.takeProfit1) / sell.riskAmount).toFixed(0)), 2);
  assert.equal(Number(((sell.entryPrice - sell.takeProfit2) / sell.riskAmount).toFixed(0)), 3);
});

test("tick age is never negative for current UTC tick", () => {
  const state = classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T00:00:02.000Z"));
  assert.equal(state.status, "live");
  assert.ok(state.age_seconds >= 0);
  assert.equal(state.received_age_seconds, 1);
  assert.equal(state.clock_skew_seconds, -1);
  assert.equal(state.is_fresh, true);
});

test("stale tick classification works", () => {
  const state = classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T01:00:00.000Z"));
  assert.equal(state.status, "stale");
});

test("future tick timestamp is handled explicitly", () => {
  const state = classifyTick("2026-01-01T00:05:00.000Z", "2026-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:01.000Z"));
  assert.equal(state.status, "stale");
  assert.equal(state.freshness, "future_timestamp");
  assert.equal(state.age_seconds, 0);
  assert.equal(state.clock_skew_seconds, 300);
});

test("older broker event time can still be live when received recently", () => {
  const state = classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:03:00.000Z", new Date("2026-01-01T00:03:10.000Z"));
  assert.equal(state.status, "live");
  assert.equal(state.freshness, "live");
  assert.equal(state.is_fresh, true);
  assert.equal(state.received_age_seconds, 10);
  assert.equal(state.clock_skew_seconds, -180);
});

test("broker-local formatted tick time parses without duplicate timezone conversion", () => {
  const normalized = normalizeTickTime({ tick_time: "2026-01-01 12:30:15" }, new Date("2026-01-01T12:30:20.000Z"));
  assert.equal(normalized.tickTime.toISOString(), "2026-01-01T12:30:15.000Z");
});

test("MT5 epoch tick fields are preferred", () => {
  const normalized = normalizeTickTime({ tick_time: "2030-01-01 00:00:00", time: 1767225600 }, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(normalized.tickTime.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("MT5 unix milliseconds convert correctly without a three-hour shift", () => {
  const normalized = normalizeTickTime({ time_msc: 1767225600123 }, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(normalized.tickTime.toISOString(), "2026-01-01T00:00:00.123Z");
});

test("backend trusts bridge-normalized tick_time and does not subtract broker offset again", () => {
  const normalized = normalizeTickTime({
    tick_time: "2026-01-01T00:00:00.000Z",
    raw_tick_time: "2026-01-01T03:00:00.000Z",
    time_msc: 1767236400000,
    clock_offset_seconds: 10800,
  });
  assert.equal(normalized.tickTime.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("fresh bridge-normalized tick remains live", () => {
  const normalized = normalizeTickTime({ tick_time: "2026-01-01T00:00:00.000Z", clock_offset_seconds: 7200 });
  const state = classifyTick(normalized.tickTime, "2026-01-01T00:00:01.000Z", new Date("2026-01-01T00:00:02.000Z"));
  assert.deepEqual(
    { freshness: state.freshness, status: state.status, is_fresh: state.is_fresh },
    { freshness: "live", status: "live", is_fresh: true },
  );
});

test("past ticks remain past and current ticks remain current", () => {
  const past = classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T00:05:00.000Z"));
  const current = classifyTick("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z", new Date("2026-01-01T00:00:10.000Z"));
  assert.equal(past.status, "stale");
  assert.equal(current.status, "live");
});

test("D1 candle during live ticks is not falsely labelled market_closed", () => {
  const state = classifyCandleFreshness({
    timeframe: "D1",
    candleCount: 500,
    latestClosedCandleTime: "2026-01-01T00:00:00.000Z",
    latestStoredCandleTime: "2026-01-02T00:00:00.000Z",
    liveTicksAvailable: true,
    now: new Date("2026-01-02T12:00:00.000Z"),
  });
  assert.equal(state.freshness, "forming_current");
  assert.equal(state.market_session_status, "open");
});

test("H1 and H4 forming candles are current when fresh ticks prove market open", () => {
  const h1 = classifyCandleFreshness({
    timeframe: "H1",
    candleCount: 500,
    latestClosedCandleTime: "2026-01-01T10:00:00.000Z",
    latestStoredCandleTime: "2026-01-01T11:00:00.000Z",
    liveTicksAvailable: true,
    now: new Date("2026-01-01T11:20:00.000Z"),
  });
  const h4 = classifyCandleFreshness({
    timeframe: "H4",
    candleCount: 500,
    latestClosedCandleTime: "2026-01-01T08:00:00.000Z",
    latestStoredCandleTime: "2026-01-01T12:00:00.000Z",
    liveTicksAvailable: true,
    now: new Date("2026-01-01T12:35:00.000Z"),
  });
  assert.equal(h1.freshness, "forming_current");
  assert.equal(h4.freshness, "forming_current");
});

test("alert dedupe key is stable for identical open alerts and distinct after metadata changes", () => {
  const first = buildAlertDedupeKey({ symbol: "XAUUSD", alertType: "price_entering_zone", relatedZoneId: 42, metadata: { state: "inside" } });
  const duplicate = buildAlertDedupeKey({ symbol: "XAUUSD", alertType: "price_entering_zone", relatedZoneId: 42, metadata: { state: "inside" } });
  const laterDistinct = buildAlertDedupeKey({ symbol: "XAUUSD", alertType: "price_entering_zone", relatedZoneId: 43, metadata: { state: "inside" } });
  assert.equal(first, duplicate);
  assert.notEqual(first, laterDistinct);
});
