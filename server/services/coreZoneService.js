const pool = require("../db/connection");
const { getAssetBySymbol } = require("../market/candleCollector");
const { getInstrument } = require("../market/instrumentRegistry");
const { fetchClosedCandles } = require("./coreEmaService");
const { MT5_SOURCE } = require("./mt5EvidencePolicy");

const overlap = (aLow, aHigh, bLow, bHigh) => Math.max(0, Math.min(aHigh, bHigh) - Math.max(aLow, bLow));
const zoneWidth = (zone) => Number(zone.zone_high) - Number(zone.zone_low);
const midpoint = (zone) => (Number(zone.zone_high) + Number(zone.zone_low)) / 2;

const detectH4Zones = (candles) => {
  const zones = [];
  if (candles.length < 20) return { zones, reason: "insufficient_h4_candles" };
  const ranges = candles.map((candle) => Number(candle.high) - Number(candle.low));
  const averageRange = ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
  for (let index = 3; index < candles.length - 3; index += 1) {
    const base = candles.slice(index - 2, index + 1);
    const departure = candles[index + 1];
    const baseHigh = Math.max(...base.map((candle) => Number(candle.high)));
    const baseLow = Math.min(...base.map((candle) => Number(candle.low)));
    const width = baseHigh - baseLow;
    if (!Number.isFinite(width) || width <= 0 || width > averageRange * 1.4) continue;
    const departureRange = Number(departure.high) - Number(departure.low);
    const departureStrength = departureRange / Math.max(width, 0.00000001);
    if (departureStrength < 1.6) continue;
    const departureClose = Number(departure.close);
    const zoneType = departureClose > baseHigh ? "demand" : departureClose < baseLow ? "supply" : null;
    if (!zoneType) continue;
    const duplicate = zones.some((zone) => overlap(zone.zone_low, zone.zone_high, baseLow, baseHigh) / Math.min(zoneWidth(zone), width) > 0.6);
    if (duplicate) continue;
    const recencyScore = index / candles.length;
    const cleanliness = base.every((candle) => Number(candle.high) <= baseHigh && Number(candle.low) >= baseLow) ? 1 : 0.7;
    zones.push({
      zone_type: zoneType,
      zone_high: Number(baseHigh.toFixed(10)),
      zone_low: Number(baseLow.toFixed(10)),
      origin_time: departure.candle_time,
      origin_candle_index: index + 1,
      base_start_time: base[0].candle_time,
      base_end_time: base.at(-1).candle_time,
      departure_strength: Number(departureStrength.toFixed(4)),
      quality_score: Number(Math.min(100, 35 + departureStrength * 18 + recencyScore * 25 + cleanliness * 15).toFixed(2)),
      source_time: departure.candle_time,
      strength: Math.max(1, Math.min(5, Math.round(departureStrength))),
    });
  }
  zones.sort((a, b) => b.quality_score - a.quality_score || new Date(b.origin_time) - new Date(a.origin_time));
  return { zones: zones.slice(0, 5), reason: zones.length ? null : "no_clean_base_departure_found" };
};

const classifyZone = (zone, latestClose, livePrice) => {
  const high = Number(zone.zone_high);
  const low = Number(zone.zone_low);
  const price = Number.isFinite(Number(livePrice)) ? Number(livePrice) : latestClose;
  const width = high - low;
  const buffer = Math.max(width, Math.abs(price) * 0.002);
  if (zone.zone_type === "demand" && latestClose < low - width * 0.25) return { status: "broken", invalidation_reason: "closed_decisively_below_demand" };
  if (zone.zone_type === "supply" && latestClose > high + width * 0.25) return { status: "broken", invalidation_reason: "closed_decisively_above_supply" };
  if (price >= low && price <= high) return { status: "inside" };
  if (Math.abs(price - midpoint(zone)) <= buffer * 2) return { status: "approaching" };
  return { status: "active" };
};

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
    const distance = Number.isFinite(Number(livePrice)) ? Math.abs(Number(livePrice) - midpoint(zone)) : null;
    const existing = await pool.query(
      `UPDATE zones
       SET status=$6, departure_strength=$7, quality_score=$8, distance_from_live_price=$9,
         updated_at=CURRENT_TIMESTAMP, invalidated_at=CASE WHEN $6='broken' THEN COALESCE(invalidated_at,CURRENT_TIMESTAMP) ELSE invalidated_at END,
         invalidation_reason=COALESCE($10,invalidation_reason), source=$11
       WHERE asset_id=$1 AND timeframe='H4' AND zone_type=$2 AND zone_high=$3 AND zone_low=$4 AND source_time=$5
       RETURNING *`,
      [asset.id, zone.zone_type, zone.zone_high, zone.zone_low, zone.source_time, state.status, zone.departure_strength, zone.quality_score, distance, state.invalidation_reason || null, MT5_SOURCE],
    );
    if (existing.rows[0]) {
      updated += 1;
      saved.push(existing.rows[0]);
      continue;
    }
    const result = await pool.query(
      `INSERT INTO zones
       (asset_id,broker_symbol,zone_type,zone_high,zone_low,timeframe,status,strength,source_time,origin_time,origin_candle_index,base_start_time,base_end_time,departure_strength,quality_score,distance_from_live_price,updated_at,invalidated_at,invalidation_reason,source)
       VALUES ($1,$2,$3,$4,$5,'H4',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,$16,$17,$18)
       RETURNING *`,
      [asset.id, instrument.brokerSymbol, zone.zone_type, zone.zone_high, zone.zone_low, state.status, zone.strength, zone.source_time, zone.origin_time, zone.origin_candle_index, zone.base_start_time, zone.base_end_time, zone.departure_strength, zone.quality_score, distance, state.status === "broken" ? new Date() : null, state.invalidation_reason || null, MT5_SOURCE],
    );
    created += 1;
    saved.push(result.rows[0]);
  }
  await pool.query(
    `UPDATE zones
     SET status='expired', updated_at=CURRENT_TIMESTAMP
     WHERE asset_id=$1 AND timeframe='H4' AND source=$2 AND status IN ('active','approaching','inside','tested')
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
     WHERE asset_id=$1 AND timeframe='H4' AND status IN ('active','approaching','inside','tested') AND source=$2
     ORDER BY ABS(((zone_high + zone_low) / 2) - $3::numeric) ASC, quality_score DESC NULLS LAST, source_time DESC NULLS LAST
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
