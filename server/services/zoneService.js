const pool = require("../db/connection");

const timeframeLockKeys = {
  H1: 1,
  H4: 4,
  D1: 24,
};

const getActiveZone = async (assetId) => {
  const result = await pool.query(
    `
    SELECT z.*
    FROM zones z
    WHERE z.asset_id = $1
    AND z.timeframe = 'H4'
    AND z.status = 'active'
    AND z.broken_at IS NULL
    AND z.mitigated_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM zones retired
      WHERE retired.id <> z.id
      AND retired.asset_id = z.asset_id
      AND retired.timeframe = z.timeframe
      AND retired.zone_type = z.zone_type
      AND retired.zone_high = z.zone_high
      AND retired.zone_low = z.zone_low
      AND (
        retired.broken_at IS NOT NULL
        OR retired.mitigated_at IS NOT NULL
        OR retired.status IN ('broken', 'mitigated')
      )
    )
    ORDER BY z.strength DESC, z.source_time DESC, z.created_at DESC
    LIMIT 1
    `,
    [assetId],
  );

  return result.rows[0] || null;
};

const saveDetectedZone = async (assetId, timeframe, zone) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
      Number(assetId),
      timeframeLockKeys[timeframe] || 0,
    ]);

    const existing = await client.query(
      `
      SELECT *
      FROM zones
      WHERE asset_id = $1
      AND timeframe = $2
      AND zone_type = $3
      AND zone_high = $4
      AND zone_low = $5
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        source_time DESC NULLS LAST,
        created_at DESC
      LIMIT 1
      `,
      [assetId, timeframe, zone.zone_type, zone.zone_high, zone.zone_low],
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return {
        zone: existing.rows[0],
        created: false,
      };
    }

    const saved = await client.query(
      `
      INSERT INTO zones
      (
        asset_id,
        zone_type,
        zone_high,
        zone_low,
        timeframe,
        status,
        strength,
        source_time
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      RETURNING *
      `,
      [
        assetId,
        zone.zone_type,
        zone.zone_high,
        zone.zone_low,
        timeframe,
        zone.strength || 1,
        zone.source_time || null,
      ],
    );

    await client.query("COMMIT");

    return {
      zone: saved.rows[0],
      created: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getActiveZone,
  saveDetectedZone,
};
