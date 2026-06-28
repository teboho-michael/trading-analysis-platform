const pool = require("../db/connection");

const createSignalForZone = async ({
  assetId,
  zoneId,
  signalType,
  entryPrice,
  stopLoss,
  takeProfit1,
  takeProfit2,
  riskReward,
  riskAmount = null,
  accountRiskAmount = null,
  positionSizeUnits = null,
  positionSizeNote = null,
  status = "active",
}) => {
  if (!assetId || !zoneId) {
    const error = new Error("asset_id and zone_id are required");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize creation for one asset/zone pair so concurrent scans cannot
    // both pass the duplicate check.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
      Number(assetId),
      Number(zoneId),
    ]);

    const zoneResult = await client.query(
      "SELECT id FROM zones WHERE id = $1 AND asset_id = $2",
      [zoneId, assetId],
    );

    if (zoneResult.rows.length === 0) {
      const error = new Error("Zone not found for this asset");
      error.statusCode = 404;
      throw error;
    }

    const existing = await client.query(
      `
      SELECT *
      FROM signals
      WHERE asset_id = $1
      AND zone_id = $2
      AND signal_type = $3
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [assetId, zoneId, signalType],
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return {
        signal: existing.rows[0],
        created: false,
      };
    }

    const saved = await client.query(
      `
      INSERT INTO signals
      (
        asset_id,
        zone_id,
        signal_type,
        entry_price,
        stop_loss,
        take_profit_1,
        take_profit_2,
        risk_reward,
        risk_amount,
        account_risk_amount,
        position_size_units,
        position_size_note,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        assetId,
        zoneId,
        signalType,
        entryPrice,
        stopLoss,
        takeProfit1,
        takeProfit2,
        riskReward,
        riskAmount,
        accountRiskAmount,
        positionSizeUnits,
        positionSizeNote,
        status,
      ],
    );

    await client.query("COMMIT");

    return {
      signal: saved.rows[0],
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
  createSignalForZone,
};
