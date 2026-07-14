const pool = require("../db/connection");
const { evaluateZoneLifecycle } = require("../analysis/zoneLifecycleEngine");
const { createAlertEvent } = require("./alertService");
const { MT5_SOURCE } = require("./mt5MarketMetadataService");

const updateZoneLifecycle = async (assetId) => {
  const assetResult = await pool.query("SELECT symbol FROM assets WHERE id=$1", [assetId]);
  const symbol = assetResult.rows[0]?.symbol || "UNKNOWN";
  // Normalize states written by older lifecycle code where the corrected
  // status will not conflict with a preserved historical row.
  await pool.query(
    `
    UPDATE zones z
    SET status = 'broken'
    WHERE z.asset_id = $1
    AND z.broken_at IS NOT NULL
    AND z.status <> 'broken'
    AND NOT EXISTS (
      SELECT 1
      FROM zones existing
      WHERE existing.id <> z.id
      AND existing.asset_id = z.asset_id
      AND existing.timeframe = z.timeframe
      AND existing.zone_type = z.zone_type
      AND existing.zone_high = z.zone_high
      AND existing.zone_low = z.zone_low
      AND existing.status = 'broken'
    )
    `,
    [assetId],
  );

  await pool.query(
    `
    UPDATE zones z
    SET status = 'mitigated'
    WHERE z.asset_id = $1
    AND z.broken_at IS NULL
    AND z.mitigated_at IS NOT NULL
    AND z.status <> 'mitigated'
    AND NOT EXISTS (
      SELECT 1
      FROM zones existing
      WHERE existing.id <> z.id
      AND existing.asset_id = z.asset_id
      AND existing.timeframe = z.timeframe
      AND existing.zone_type = z.zone_type
      AND existing.zone_high = z.zone_high
      AND existing.zone_low = z.zone_low
      AND existing.status = 'mitigated'
    )
    `,
    [assetId],
  );

  const candleResult = await pool.query(
    `
    SELECT high, low, close, candle_time
    FROM candles
    WHERE asset_id = $1
    AND timeframe = 'H1'
    AND source = $2
    ORDER BY candle_time DESC
    LIMIT 1
    `,
    [assetId, MT5_SOURCE],
  );

  if (candleResult.rows.length === 0) {
    return {
      zonesChecked: 0,
      zonesTouched: 0,
      zonesMitigated: 0,
      zonesBroken: 0,
    };
  }

  const latestCandle = candleResult.rows[0];
  const zonesResult = await pool.query(
    `
    SELECT *
    FROM zones
    WHERE asset_id = $1
    AND status = 'active'
    AND broken_at IS NULL
    AND mitigated_at IS NULL
    `,
    [assetId],
  );

  let zonesTouched = 0;
  let zonesMitigated = 0;
  let zonesBroken = 0;

  for (const zone of zonesResult.rows) {
    const lifecycle = evaluateZoneLifecycle(zone, latestCandle);

    if (lifecycle.broken) {
      await pool.query(
        `
        UPDATE zones
        SET
          status = 'broken',
          broken_at = COALESCE(broken_at, CURRENT_TIMESTAMP),
          touched_at = CASE
            WHEN $2 THEN COALESCE(touched_at, CURRENT_TIMESTAMP)
            ELSE touched_at
          END
        WHERE id = $1
        `,
        [zone.id, lifecycle.touched],
      );

      if (lifecycle.touched) zonesTouched += 1;
      zonesBroken += 1;
      if (lifecycle.touched) await createAlertEvent({ assetId, symbol, alertType: "zone_touched", message: `${symbol} ${zone.zone_type} zone touched`, relatedZoneId: zone.id });
      await createAlertEvent({ assetId, symbol, alertType: "zone_broken", severity: "important", message: `${symbol} ${zone.zone_type} zone broken`, relatedZoneId: zone.id });
      continue;
    }

    if (lifecycle.mitigated) {
      await pool.query(
        `
        UPDATE zones
        SET
          status = 'mitigated',
          touched_at = COALESCE(touched_at, CURRENT_TIMESTAMP),
          mitigated_at = COALESCE(mitigated_at, CURRENT_TIMESTAMP)
        WHERE id = $1
        `,
        [zone.id],
      );

      zonesTouched += 1;
      zonesMitigated += 1;
      await createAlertEvent({ assetId, symbol, alertType: "zone_touched", message: `${symbol} ${zone.zone_type} zone touched`, relatedZoneId: zone.id });
      await createAlertEvent({ assetId, symbol, alertType: "zone_mitigated", message: `${symbol} ${zone.zone_type} zone touched and mitigated`, relatedZoneId: zone.id });
    }
  }

  return {
    zonesChecked: zonesResult.rows.length,
    zonesTouched,
    zonesMitigated,
    zonesBroken,
  };
};

module.exports = {
  updateZoneLifecycle,
};
