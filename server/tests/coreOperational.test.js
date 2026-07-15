const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateEmaStateFromCandles } = require("../services/coreEmaService");
const { detectH4Zones, classifyZone } = require("../services/coreZoneService");
const { displayPriceFrom, classifyTick } = require("../services/liveTickService");
const { nearZone } = require("../services/coreSetupService");

const candles = (count, start = 100) => Array.from({ length: count }, (_, index) => ({
  open: start + index,
  high: start + index + 1,
  low: start + index - 1,
  close: start + index,
  candle_time: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
}));

test("live tick display price uses bid/ask midpoint first", () => {
  assert.equal(displayPriceFrom({ bid: 100, ask: 102, last: 99 }), 101);
  assert.equal(displayPriceFrom({ bid: null, ask: null, last: 99 }), 99);
  assert.equal(displayPriceFrom({ bid: 100, ask: null, last: null }), 100);
});

test("tick classification separates live and stale", () => {
  assert.equal(classifyTick(new Date().toISOString()).status, "live");
  assert.equal(classifyTick(new Date(Date.now() - 3600_000).toISOString()).status, "stale");
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
  const series = candles(40, 100);
  series[20] = { ...series[20], high: 120, low: 119, close: 119.5 };
  series[21] = { ...series[21], high: 120.2, low: 119.2, close: 119.7 };
  series[22] = { ...series[22], high: 120.1, low: 119.1, close: 119.8 };
  series[23] = { ...series[23], high: 130, low: 119.5, close: 129 };
  const detected = detectH4Zones(series);
  assert.ok(detected.zones.some((zone) => zone.zone_type === "demand"));
});

test("zone invalidation breaks demand after decisive close below", () => {
  const zone = { zone_type: "demand", zone_high: 110, zone_low: 100 };
  const state = classifyZone(zone, 96, 105);
  assert.equal(state.status, "broken");
});

test("setup proximity requires live price near or inside zone", () => {
  const zone = { zone_high: 110, zone_low: 100 };
  assert.equal(nearZone(105, zone).inside, true);
  assert.equal(nearZone(200, zone).near, false);
});
