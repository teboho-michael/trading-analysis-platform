const pool = require("../db/connection");
const { getAssetBySymbol } = require("../market/candleCollector");
const { calculateRiskLevels } = require("../analysis/riskEngine");
const { getEmaState, getH1Confirmation } = require("./coreEmaService");
const { getNearestActiveZone } = require("./coreZoneService");
const { getLatestTicks } = require("./liveTickService");
const { buildAlertDedupeKey, createAlertEvent } = require("./alertService");

const nearZone = (price, zone) => {
  if (!zone || !Number.isFinite(Number(price))) return { inside: false, near: false, distance: null, distancePercent: null };
  const high = Number(zone.zone_high);
  const low = Number(zone.zone_low);
  const width = high - low;
  const inside = Number(price) >= low && Number(price) <= high;
  const distance = inside ? 0 : Number(price) < low ? low - Number(price) : Number(price) - high;
  const buffer = Math.max(width * 1.5, Math.abs(Number(price)) * 0.003);
  return {
    inside,
    near: inside || distance <= buffer,
    isNearZone: inside || distance <= buffer,
    distance,
    distanceFromZone: distance,
    distancePercent: Number(((distance / Math.abs(Number(price))) * 100).toFixed(4)),
  };
};

const alignedBullish = (state) => ["bullish", "neutral"].includes(state);
const alignedBearish = (state) => ["bearish", "neutral"].includes(state);

const toLegacyTrend = (state) => state === "bullish" ? "Bullish" : state === "bearish" ? "Bearish" : state === "insufficient_data" ? "Insufficient Data" : "Neutral";

const buildSetup = async (symbol) => {
  const asset = await getAssetBySymbol(symbol);
  if (!asset) throw new Error(`Asset not found: ${symbol}`);
  const ticks = await getLatestTicks([symbol]);
  const live = ticks.prices[0];
  const livePrice = live.status === "live" ? live.price : null;
  const [d1, h4, h1, h1Confirmation] = await Promise.all([
    getEmaState(symbol, "D1"),
    getEmaState(symbol, "H4"),
    getEmaState(symbol, "H1"),
    getH1Confirmation(symbol),
  ]);
  const zone = await getNearestActiveZone(symbol, livePrice);
  const proximity = nearZone(livePrice, zone);
  const reasonsPassed = [];
  const reasonsFailed = [];
  const pass = (condition, label) => (condition ? reasonsPassed : reasonsFailed).push(label);
  pass(live.status === "live", "fresh MT5 live tick");
  pass(Boolean(zone), "nearest active H4 zone");
  pass(Boolean(zone && ["active", "tested"].includes(zone.status)), "zone is not broken or expired");
  pass(proximity.near, "live price inside or near zone");

  let signal = "WAIT";
  if (zone?.zone_type === "demand") {
    pass(alignedBullish(d1.trend_state), "D1 bullish or acceptable aligned bias");
    pass(alignedBullish(h4.trend_state), "H4 bullish or acceptable aligned bias");
    pass(h1Confirmation.trend_state === "bullish", "two closed H1 candles above EMA 200");
    if (live.status === "live" && proximity.near && alignedBullish(d1.trend_state) && alignedBullish(h4.trend_state) && h1Confirmation.trend_state === "bullish") signal = "BUY";
  } else if (zone?.zone_type === "supply") {
    pass(alignedBearish(d1.trend_state), "D1 bearish or acceptable aligned bias");
    pass(alignedBearish(h4.trend_state), "H4 bearish or acceptable aligned bias");
    pass(h1Confirmation.trend_state === "bearish", "two closed H1 candles below EMA 200");
    if (live.status === "live" && proximity.near && alignedBearish(d1.trend_state) && alignedBearish(h4.trend_state) && h1Confirmation.trend_state === "bearish") signal = "SELL";
  } else {
    reasonsFailed.push("BUY/SELL requires demand or supply zone");
  }

  const riskSignal = signal === "BUY" ? "BUY SETUP" : signal === "SELL" ? "SELL SETUP" : "WAIT";
  const risk = signal === "WAIT" ? null : calculateRiskLevels(symbol, riskSignal, livePrice, zone);
  const qualityScore = Math.max(0, Math.min(100, Math.round((zone?.quality_score || 0) * 0.55 + reasonsPassed.length * 8 - reasonsFailed.length * 5)));
  const setup = {
    signal,
    stage: signal === "WAIT" ? (zone ? "WATCH" : "WAIT") : "READY",
    quality_score: qualityScore,
    status: signal === "WAIT" ? "waiting" : "complete",
    entry_low: signal === "WAIT" ? null : Number(zone.zone_low),
    entry_high: signal === "WAIT" ? null : Number(zone.zone_high),
    stop_loss: risk?.stopLoss || null,
    tp1: risk?.takeProfit1 || null,
    tp2: risk?.takeProfit2 || null,
    risk_reward_tp1: risk ? 2 : null,
    risk_reward_tp2: risk ? 3 : null,
    zone_id: zone?.id || null,
    zone_type: zone?.zone_type || null,
    live_price: livePrice,
    live_tick: live,
    reasons_passed: reasonsPassed,
    reasons_failed: reasonsFailed,
    calculated_at: new Date().toISOString(),
    source: "mt5_broker",
    daily: d1,
    h4,
    h1,
    h1_confirmation: h1Confirmation,
    activeZone: zone,
    zoneProximity: proximity,
    risk,
  };
  return setup;
};

const recordCoreAlerts = async (symbol, setup) => {
  const asset = await getAssetBySymbol(symbol);
  if (!asset) return [];
  const alerts = [];
  const emit = async (type, severity, message, zoneId = null, metadata = {}) => {
    const event = await createAlertEvent({
      assetId: asset.id,
      symbol,
      alertType: type,
      severity,
      message,
      relatedZoneId: zoneId,
      metadata,
      dedupeKey: buildAlertDedupeKey({ symbol, alertType: type, relatedZoneId: zoneId, metadata }),
    });
    if (event) alerts.push(event);
  };
  if (setup.live_tick.status !== "live") await emit("data_stale", "important", `${symbol} MT5 live tick is ${setup.live_tick.status}`);
  if (setup.activeZone && setup.zoneProximity.near && !setup.zoneProximity.inside) await emit("price_approaching_zone", "info", `${symbol} approaching ${setup.activeZone.zone_type} zone`, setup.activeZone.id);
  if (setup.activeZone && setup.zoneProximity.inside) await emit("price_entering_zone", "important", `${symbol} inside ${setup.activeZone.zone_type} zone`, setup.activeZone.id);
  if (setup.activeZone?.status === "broken") await emit("zone_broken", "important", `${symbol} ${setup.activeZone.zone_type} zone broken`, setup.activeZone.id);
  if (setup.h1_confirmation.trend_state === "bullish" && setup.activeZone?.zone_type === "demand" && setup.zoneProximity.near) await emit("bullish_h1_confirmation_near_demand", "important", `${symbol} bullish H1 confirmation near demand`, setup.activeZone.id);
  if (setup.h1_confirmation.trend_state === "bearish" && setup.activeZone?.zone_type === "supply" && setup.zoneProximity.near) await emit("bearish_h1_confirmation_near_supply", "important", `${symbol} bearish H1 confirmation near supply`, setup.activeZone.id);
  if (setup.signal === "BUY") await emit("complete_buy_setup", "critical", `${symbol} complete BUY setup`, setup.zone_id, { quality_score: setup.quality_score });
  if (setup.signal === "SELL") await emit("complete_sell_setup", "critical", `${symbol} complete SELL setup`, setup.zone_id, { quality_score: setup.quality_score });
  return alerts;
};

const setupToDashboardFields = (setup) => ({
  signal: setup.signal,
  setupStage: setup.stage,
  qualityScore: setup.quality_score,
  dailyBias: toLegacyTrend(setup.daily.trend_state),
  h4Bias: toLegacyTrend(setup.h4.trend_state),
  h1Trend: toLegacyTrend(setup.h1_confirmation.trend_state),
  activeZone: setup.activeZone,
  zoneProximity: setup.zoneProximity,
  risk: setup.risk,
  nextAction: setup.reasons_failed[0] || "Core setup complete",
  signalReason: setup.reasons_failed[0] || "Core setup complete",
  confirmationChecklist: [
    { key: "d1Bias", label: "D1 aligned", passed: !setup.reasons_failed.includes("D1 bullish or acceptable aligned bias") && !setup.reasons_failed.includes("D1 bearish or acceptable aligned bias") },
    { key: "h4Bias", label: "H4 aligned", passed: !setup.reasons_failed.includes("H4 bullish or acceptable aligned bias") && !setup.reasons_failed.includes("H4 bearish or acceptable aligned bias") },
    { key: "h1Ema", label: "H1 two-candle EMA confirmation", passed: ["bullish", "bearish"].includes(setup.h1_confirmation.trend_state) },
    { key: "activeZone", label: "Valid H4 zone", passed: Boolean(setup.activeZone) },
    { key: "proximity", label: "Live price near zone", passed: setup.zoneProximity.near },
  ],
});

module.exports = {
  buildSetup,
  nearZone,
  recordCoreAlerts,
  setupToDashboardFields,
};
