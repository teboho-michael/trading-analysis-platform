const pool = require("../db/connection");
const { calculateTrendFromCandles } = require("../analysis/trendEngine");
const { calculateRiskLevels } = require("../analysis/riskEngine");
const { evaluateZoneLifecycle } = require("../analysis/zoneLifecycleEngine");

const ZONE_PROXIMITY_PERCENT = 0.003; // 0.3%

const fetchCandles = async (assetId, timeframe) => {
  const result = await pool.query(
    `
        SELECT open, high, low, close, volume, candle_time
        FROM candles
        WHERE asset_id = $1
        AND timeframe = $2
        ORDER BY candle_time DESC
        LIMIT 300
        `,
    [assetId, timeframe],
  );

  return result.rows;
};

const getTrend = async (assetId, timeframe) => {
  const candles = await fetchCandles(assetId, timeframe);
  return calculateTrendFromCandles(candles, 200);
};

const getActiveZone = async (assetId) => {
  const result = await pool.query(
    `
        SELECT *
FROM zones
WHERE asset_id = $1
AND timeframe = 'H4'
AND status = 'active'
AND broken_at IS NULL
AND mitigated_at IS NULL
ORDER BY strength DESC, source_time DESC, created_at DESC
LIMIT 1
        `,
    [assetId],
  );

  return result.rows[0] || null;
};

const updateZoneLifecycle = async (assetId) => {
  const candles = await fetchCandles(assetId, "H1");

  if (!candles || candles.length === 0) {
    return {
      zonesChecked: 0,
      zonesTouched: 0,
      zonesMitigated: 0,
      zonesBroken: 0,
    };
  }

  const latestCandle = candles[0];

  const zonesResult = await pool.query(
    `
        SELECT *
        FROM zones
        WHERE asset_id = $1
        AND status = 'active'
        AND broken_at IS NULL
        `,
    [assetId],
  );

  const zones = zonesResult.rows;

  let zonesTouched = 0;
  let zonesMitigated = 0;
  let zonesBroken = 0;

  for (const zone of zones) {
    const lifecycle = evaluateZoneLifecycle(zone, latestCandle);

    if (lifecycle.broken) {
      await pool.query(
        `
                UPDATE zones
                SET broken_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
        [zone.id],
      );

      zonesBroken += 1;
      continue;
    }

    if (lifecycle.touched) {
      await pool.query(
        `
                UPDATE zones
SET 
    broken_at = COALESCE(broken_at, CURRENT_TIMESTAMP),
    status = 'broken'
WHERE id = $1
                `,
        [zone.id],
      );

      zonesTouched += 1;
      zonesMitigated += 1;
    }
  }

  return {
    zonesChecked: zones.length,
    zonesTouched,
    zonesMitigated,
    zonesBroken,
  };
};

const getLatestSignal = async (assetId) => {
  const result = await pool.query(
    `
        SELECT *
        FROM signals
        WHERE asset_id = $1
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        `,
    [assetId],
  );

  return result.rows[0] || null;
};

const getZoneProximity = (price, zone) => {
  if (!price || !zone) {
    return {
      isNearZone: false,
      distanceFromZone: null,
      distancePercent: null,
      zoneBuffer: null,
    };
  }

  const zoneHigh = Number(zone.zone_high);
  const zoneLow = Number(zone.zone_low);
  const currentPrice = Number(price);

  const zoneBuffer = currentPrice * ZONE_PROXIMITY_PERCENT;

  const upperBoundary = zoneHigh + zoneBuffer;
  const lowerBoundary = zoneLow - zoneBuffer;

  const isNearZone =
    currentPrice >= lowerBoundary && currentPrice <= upperBoundary;

  let distanceFromZone = 0;

  if (currentPrice > zoneHigh) {
    distanceFromZone = currentPrice - zoneHigh;
  } else if (currentPrice < zoneLow) {
    distanceFromZone = zoneLow - currentPrice;
  }

  const distancePercent = (distanceFromZone / currentPrice) * 100;

  return {
    isNearZone,
    distanceFromZone: Number(distanceFromZone.toFixed(2)),
    distancePercent: Number(distancePercent.toFixed(2)),
    zoneBuffer: Number(zoneBuffer.toFixed(2)),
  };
};

const buildAssetAnalysis = async (asset) => {
  const daily = await getTrend(asset.id, "D1");
  const h4 = await getTrend(asset.id, "H4");
  const h1 = await getTrend(asset.id, "H1");

  const zoneLifecycle = await updateZoneLifecycle(asset.id);
  const activeZone = await getActiveZone(asset.id);
  const latestSignal = await getLatestSignal(asset.id);

  const latestPrice = h1.lastClose;
  const zoneProximity = getZoneProximity(latestPrice, activeZone);

  const bullishConfluence =
    daily.trend === "Bullish" &&
    h4.trend === "Bullish" &&
    h1.trend === "Bullish";

  const bearishConfluence =
    daily.trend === "Bearish" &&
    h4.trend === "Bearish" &&
    h1.trend === "Bearish";

  let signal = "WAIT";
  let signalReason = "No valid setup";

  if (!activeZone) {
    signalReason = "No active H4 zone";
  } else if (!zoneProximity.isNearZone) {
    signalReason = `Price is too far from ${activeZone.zone_type} zone`;
  } else if (bullishConfluence && activeZone.zone_type === "demand") {
    signal = "BUY SETUP";
    signalReason = "Bullish confluence and price near demand zone";
  } else if (bearishConfluence && activeZone.zone_type === "supply") {
    signal = "SELL SETUP";
    signalReason = "Bearish confluence and price near supply zone";
  } else {
    signalReason = "Trend confluence does not match active zone type";
  }

  const risk = calculateRiskLevels(
    asset.symbol,
    signal,
    latestPrice,
    activeZone,
  );

  const status =
    signal === "BUY SETUP" || signal === "SELL SETUP" ? "Active" : "Monitoring";

  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    status,
    latestPrice,
    dailyBias: daily.trend,
    h4Bias: h4.trend,
    h1Trend: h1.trend,
    activeZone,
    zoneLifecycle,
    zoneProximity,
    signal,
    signalReason,
    risk,
    latestSignal,
  };
};

const getDashboard = async (req, res) => {
  try {
    const assetsResult = await pool.query(
      `
            SELECT *
            FROM assets
            ORDER BY id ASC
            `,
    );

    const dashboard = [];

    for (const asset of assetsResult.rows) {
      const analysis = await buildAssetAnalysis(asset);
      dashboard.push(analysis);
    }

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getDashboard,
};
