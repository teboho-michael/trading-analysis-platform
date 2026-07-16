const pool = require("../db/connection");
const { getAssetBySymbol } = require("../market/candleCollector");
const { getInstrument } = require("../market/instrumentRegistry");
const { fetchClosedCandles } = require("./coreEmaService");
const { MT5_SOURCE } = require("./mt5EvidencePolicy");

const overlap = (aLow, aHigh, bLow, bHigh) => Math.max(0, Math.min(aHigh, bHigh) - Math.max(aLow, bLow));
const zoneWidth = (zone) => Number(zone.zone_high) - Number(zone.zone_low);
const midpoint = (zone) => (Number(zone.zone_high) + Number(zone.zone_low)) / 2;
const roundPrice = (value) => Number(Number(value).toFixed(10));
const distanceFromZone = (price, zone) => {
  if (!Number.isFinite(Number(price))) return null;
  if (Number(price) >= Number(zone.zone_low) && Number(price) <= Number(zone.zone_high)) return 0;
  return Number(price) < Number(zone.zone_low) ? Number(zone.zone_low) - Number(price) : Number(price) - Number(zone.zone_high);
};

const CONFIG = Object.freeze({
  lookback: Number(process.env.H4_ZONE_LOOKBACK || 220),
  minBaseCandles: 1,
  maxBaseCandles: 6,
  atrPeriod: 14,
  maxBaseAtrMultiple: 1.8,
  maxZonePricePercent: 0.035,
  maxAverageBaseBodyAtrMultiple: 0.75,
  minDepartureAtrMultiple: 1.15,
  minDepartureZoneMultiple: 1.25,
  minCloseBeyondBaseAtrMultiple: 0.18,
  invalidationCloseZoneMultiple: 0.15,
});

const bodyHigh = (candle) => Math.max(Number(candle.open), Number(candle.close));
const bodyLow = (candle) => Math.min(Number(candle.open), Number(candle.close));
const candleRange = (candle) => Number(candle.high) - Number(candle.low);
const candleBody = (candle) => Math.abs(Number(candle.close) - Number(candle.open));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const candleTimeMs = (value) => new Date(value).getTime();

const atrAt = (candles, endIndex, period = CONFIG.atrPeriod) => {
  const start = Math.max(0, endIndex - period + 1);
  const ranges = candles.slice(start, endIndex + 1).map(candleRange).filter((value) => Number.isFinite(value) && value > 0);
  return average(ranges);
};

const isWellFormedCandle = (candle) => ["open", "high", "low", "close"].every((field) => Number.isFinite(Number(candle[field])));

const buildZoneCandidate = (candles, baseStart, baseLength) => {
  const baseEnd = baseStart + baseLength - 1;
  const departure = candles[baseEnd + 1];
  const followThrough = candles[baseEnd + 2];
  if (!departure || !baseLength || !candles.slice(baseStart, baseEnd + 2).every(isWellFormedCandle)) return null;

  const base = candles.slice(baseStart, baseEnd + 1);
  const atr = atrAt(candles, baseEnd);
  if (!Number.isFinite(atr) || atr <= 0) return null;

  const baseHigh = Math.max(...base.map((candle) => Number(candle.high)));
  const baseLow = Math.min(...base.map((candle) => Number(candle.low)));
  const highestBody = Math.max(...base.map(bodyHigh));
  const lowestBody = Math.min(...base.map(bodyLow));
  const width = baseHigh - baseLow;
  const averageBody = average(base.map(candleBody));
  const averageRange = average(base.map(candleRange));
  const referencePrice = Math.max(Math.abs(Number(departure.close)), 0.00000001);

  if (!Number.isFinite(width) || width <= 0) return { rejected: "malformed_or_zero_width_zone" };
  if (width > atr * CONFIG.maxBaseAtrMultiple || width / referencePrice > CONFIG.maxZonePricePercent) return { rejected: "zone_too_wide" };
  if (averageBody > atr * CONFIG.maxAverageBaseBodyAtrMultiple || averageRange > atr * CONFIG.maxBaseAtrMultiple) return { rejected: "base_not_compact" };

  const departureRange = candleRange(departure);
  const departureBody = candleBody(departure);
  const bullishCloseBeyond = Number(departure.close) - baseHigh;
  const bearishCloseBeyond = baseLow - Number(departure.close);
  const bullishFollowThrough = followThrough ? Number(followThrough.close) >= Math.max(highestBody, Number(departure.open)) : true;
  const bearishFollowThrough = followThrough ? Number(followThrough.close) <= Math.min(lowestBody, Number(departure.open)) : true;

  const bullishStrength = Math.min(departureRange / width, departureBody / Math.max(atr, 0.00000001), Math.max(0, bullishCloseBeyond) / Math.max(atr * CONFIG.minCloseBeyondBaseAtrMultiple, 0.00000001));
  const bearishStrength = Math.min(departureRange / width, departureBody / Math.max(atr, 0.00000001), Math.max(0, bearishCloseBeyond) / Math.max(atr * CONFIG.minCloseBeyondBaseAtrMultiple, 0.00000001));

  let zoneType = null;
  let departureStrength = 0;
  if (
    bullishCloseBeyond > atr * CONFIG.minCloseBeyondBaseAtrMultiple &&
    departureRange >= atr * CONFIG.minDepartureAtrMultiple &&
    departureRange >= width * CONFIG.minDepartureZoneMultiple &&
    Number(departure.close) > Number(departure.open) &&
    bullishFollowThrough
  ) {
    zoneType = "demand";
    departureStrength = bullishStrength;
  } else if (
    bearishCloseBeyond > atr * CONFIG.minCloseBeyondBaseAtrMultiple &&
    departureRange >= atr * CONFIG.minDepartureAtrMultiple &&
    departureRange >= width * CONFIG.minDepartureZoneMultiple &&
    Number(departure.close) < Number(departure.open) &&
    bearishFollowThrough
  ) {
    zoneType = "supply";
    departureStrength = bearishStrength;
  }

  if (!zoneType) return { rejected: "weak_departure" };

  const proximal = zoneType === "demand" ? highestBody : lowestBody;
  const distal = zoneType === "demand" ? baseLow : baseHigh;
  const zoneHigh = Math.max(proximal, distal);
  const zoneLow = Math.min(proximal, distal);
  const usableWidth = zoneHigh - zoneLow;
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) return { rejected: "malformed_or_zero_width_zone" };
  if (usableWidth > atr * CONFIG.maxBaseAtrMultiple || usableWidth / referencePrice > CONFIG.maxZonePricePercent) return { rejected: "zone_too_wide" };

  const compactness = Math.max(0, 1 - usableWidth / Math.max(atr * CONFIG.maxBaseAtrMultiple, 0.00000001));
  const recency = baseEnd / Math.max(candles.length - 1, 1);
  const strengthScore = Math.min(1, departureStrength / 4);
  const qualityScore = Math.min(100, 35 + strengthScore * 35 + compactness * 20 + recency * 10);

  return {
    zone_type: zoneType,
    zone_high: roundPrice(zoneHigh),
    zone_low: roundPrice(zoneLow),
    proximal_price: roundPrice(proximal),
    distal_price: roundPrice(distal),
    origin_time: departure.candle_time,
    origin_candle_index: baseEnd + 1,
    base_start_time: base[0].candle_time,
    base_end_time: base.at(-1).candle_time,
    departure_strength: Number(departureStrength.toFixed(4)),
    quality_score: Number(qualityScore.toFixed(2)),
    source_time: departure.candle_time,
    strength: Math.max(1, Math.min(5, Math.round(departureStrength))),
  };
};

const detectH4Zones = (candles, options = {}) => {
  candles = candles.filter((candle) => candle.status !== "forming_current" && candle.isForming !== true);
  const zones = [];
  const rejections = new Map();
  const lookback = Math.max(20, Number(options.lookback || CONFIG.lookback));
  const recentCandles = candles.slice(-lookback);
  if (recentCandles.length < CONFIG.atrPeriod + CONFIG.maxBaseCandles + 2) return { zones, reason: "insufficient_h4_candles" };

  for (let baseStart = CONFIG.atrPeriod; baseStart < recentCandles.length - 1; baseStart += 1) {
    for (let baseLength = CONFIG.minBaseCandles; baseLength <= CONFIG.maxBaseCandles; baseLength += 1) {
      if (baseStart + baseLength >= recentCandles.length) continue;
      const candidate = buildZoneCandidate(recentCandles, baseStart, baseLength);
      if (!candidate) continue;
      if (candidate.rejected) {
        rejections.set(candidate.rejected, (rejections.get(candidate.rejected) || 0) + 1);
        continue;
      }
      const width = zoneWidth(candidate);
      if (width <= 0) continue;
      const duplicate = zones.some((zone) => {
        const smallestWidth = Math.min(zoneWidth(zone), width);
        return zone.zone_type === candidate.zone_type && (
          Math.abs(candleTimeMs(zone.origin_time) - candleTimeMs(candidate.origin_time)) < 5 * 60 * 1000 ||
          overlap(zone.zone_low, zone.zone_high, candidate.zone_low, candidate.zone_high) / Math.max(smallestWidth, 0.00000001) > 0.7
        );
      });
      if (duplicate) continue;
      zones.push(candidate);
    }
  }
  zones.sort((a, b) => b.quality_score - a.quality_score || new Date(b.origin_time) - new Date(a.origin_time));
  const reason = zones.length ? null : [...rejections.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "no_clean_base_departure_found";
  return { zones: zones.slice(0, 8), reason };
};

const boundaryPrices = (zone) => {
  const high = Number(zone.zone_high);
  const low = Number(zone.zone_low);
  const proximal = Number.isFinite(Number(zone.proximal_price)) ? Number(zone.proximal_price) : zone.zone_type === "demand" ? high : low;
  const distal = Number.isFinite(Number(zone.distal_price)) ? Number(zone.distal_price) : zone.zone_type === "demand" ? low : high;
  return { high, low, proximal, distal, width: high - low };
};

const classifyZone = (zone, latestClose, livePrice) => {
  const { high, low, distal, width } = boundaryPrices(zone);
  const price = Number.isFinite(Number(livePrice)) ? Number(livePrice) : latestClose;
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(width) || width <= 0) return { status: "broken", invalidation_reason: "malformed_zone_boundaries" };
  const decisiveBuffer = width * CONFIG.invalidationCloseZoneMultiple;
  if (zone.zone_type === "demand" && Number.isFinite(Number(latestClose)) && Number(latestClose) < distal - decisiveBuffer) return { status: "broken", invalidation_reason: "closed_decisively_below_demand_distal" };
  if (zone.zone_type === "supply" && Number.isFinite(Number(latestClose)) && Number(latestClose) > distal + decisiveBuffer) return { status: "broken", invalidation_reason: "closed_decisively_above_supply_distal" };
  if (Number.isFinite(Number(price)) && Number(price) >= low && Number(price) <= high) return { status: "tested", retested: true };
  return { status: "active" };
};

const zoneDistanceSql = (priceSql) => `CASE
  WHEN $${priceSql}::numeric BETWEEN zone_low AND zone_high THEN 0
  WHEN $${priceSql}::numeric < zone_low THEN zone_low - $${priceSql}::numeric
  ELSE $${priceSql}::numeric - zone_high
END`;

const updateExistingZone = async ({ assetId, zone, state, distance }) => pool.query(
  `UPDATE zones
   SET status=CASE WHEN status='broken' THEN status ELSE $6 END,
     zone_high=$7, zone_low=$8, proximal_price=$9, distal_price=$10,
     departure_strength=$11, quality_score=$12, distance_from_live_price=$13,
     test_count=test_count + CASE WHEN $14::boolean AND status <> 'tested' THEN 1 ELSE 0 END,
     updated_at=CURRENT_TIMESTAMP,
     invalidated_at=CASE WHEN $6='broken' OR status='broken' THEN COALESCE(invalidated_at,CURRENT_TIMESTAMP) ELSE invalidated_at END,
     broken_at=CASE WHEN $6='broken' OR status='broken' THEN COALESCE(broken_at,CURRENT_TIMESTAMP) ELSE broken_at END,
     invalidation_reason=COALESCE($15,invalidation_reason), source=$16
   WHERE asset_id=$1 AND timeframe='H4' AND zone_type=$2 AND source=$16
     AND (
       origin_time=$3
       OR (base_start_time=$4 AND base_end_time=$5)
       OR (GREATEST(0, LEAST(zone_high, $7::numeric) - GREATEST(zone_low, $8::numeric)) / NULLIF(LEAST(zone_high-zone_low, $7::numeric-$8::numeric), 0) > 0.75)
     )
   RETURNING *`,
  [
    assetId,
    zone.zone_type,
    zone.origin_time,
    zone.base_start_time,
    zone.base_end_time,
    state.status,
    zone.zone_high,
    zone.zone_low,
    zone.proximal_price,
    zone.distal_price,
    zone.departure_strength,
    zone.quality_score,
    distance,
    Boolean(state.retested),
    state.invalidation_reason || null,
    MT5_SOURCE,
  ],
);

const saveZonesForSymbol = async (symbol, livePrice = null) => {
  const asset = await getAssetBySymbol(symbol);
  if (!asset) throw new Error(`Asset not found: ${symbol}`);
  const instrument = getInstrument(symbol);
  const candles = await fetchClosedCandles(symbol, "H4", 320);
  const detected = detectH4Zones(candles);
  const latestClose = candles.length ? Number(candles.at(-1).close) : null;
  let created = 0;
  let updated = 0;
  const saved = [];
  for (const zone of detected.zones) {
    const state = classifyZone(zone, latestClose, livePrice);
    const distance = distanceFromZone(livePrice, zone);
    const existing = await updateExistingZone({ assetId: asset.id, zone, state, distance });
    if (existing.rows[0]) {
      updated += 1;
      saved.push(existing.rows[0]);
      continue;
    }
    const result = await pool.query(
      `INSERT INTO zones
       (asset_id,broker_symbol,zone_type,zone_high,zone_low,proximal_price,distal_price,timeframe,status,strength,source_time,origin_time,origin_candle_index,base_start_time,base_end_time,departure_strength,quality_score,distance_from_live_price,updated_at,invalidated_at,invalidation_reason,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'H4',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP,$18,$19,$20)
       RETURNING *`,
      [asset.id, instrument.brokerSymbol, zone.zone_type, zone.zone_high, zone.zone_low, zone.proximal_price, zone.distal_price, state.status, zone.strength, zone.source_time, zone.origin_time, zone.origin_candle_index, zone.base_start_time, zone.base_end_time, zone.departure_strength, zone.quality_score, distance, state.status === "broken" ? new Date() : null, state.invalidation_reason || null, MT5_SOURCE],
    );
    created += 1;
    saved.push(result.rows[0]);
  }
  await pool.query(
    `UPDATE zones
     SET status='expired', updated_at=CURRENT_TIMESTAMP
     WHERE asset_id=$1 AND timeframe='H4' AND source=$2 AND status IN ('active','tested')
       AND source_time < CURRENT_TIMESTAMP - INTERVAL '90 days'`,
    [asset.id, MT5_SOURCE],
  );
  return { symbol, zones_created: created, zones_updated: updated, zones: saved, reason: detected.reason };
};

const getNearestActiveZone = async (symbol, livePrice) => {
  const asset = await getAssetBySymbol(symbol);
  if (!asset) return null;
  const result = await pool.query(
    `SELECT *
     FROM zones
     WHERE asset_id=$1 AND timeframe='H4' AND status IN ('active','tested') AND source=$2
     ORDER BY ${zoneDistanceSql(3)} ASC, quality_score DESC NULLS LAST, origin_time DESC NULLS LAST
     LIMIT 1`,
    [asset.id, MT5_SOURCE, Number.isFinite(Number(livePrice)) ? Number(livePrice) : 0],
  );
  return result.rows[0] || null;
};

module.exports = {
  classifyZone,
  detectH4Zones,
  getNearestActiveZone,
  saveZonesForSymbol,
};
