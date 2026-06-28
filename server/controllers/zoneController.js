const pool = require("../db/connection");
const { detectZones } = require("../analysis/zoneEngine");
const { saveDetectedZone } = require("../services/zoneService");

const getAllZones = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
                zones.id,
                assets.symbol,
                zones.zone_type,
                zones.zone_high,
                zones.zone_low,
                zones.timeframe,
                zones.status,
                zones.strength,
                zones.source_time,
                zones.touched_at,
                zones.mitigated_at,
                zones.broken_at,
                zones.created_at
            FROM zones
            JOIN assets ON zones.asset_id = assets.id
            ORDER BY zones.created_at DESC
        `);

    res.json({
      success: true,
      zones: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const detectAndSaveZones = async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;

    const assetResult = await pool.query(
      "SELECT id FROM assets WHERE symbol = $1",
      [symbol],
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    const assetId = assetResult.rows[0].id;

    const candleResult = await pool.query(
      `
            SELECT open, high, low, close, candle_time
            FROM candles
            WHERE asset_id = $1
            AND timeframe = $2
            ORDER BY candle_time DESC
            LIMIT 300
            `,
      [assetId, timeframe],
    );

    const detectedZones = detectZones(candleResult.rows);
    const savedZones = [];

    for (const zone of detectedZones) {
      const saved = await saveDetectedZone(assetId, timeframe, zone);

      savedZones.push(saved.zone);
    }

    res.json({
      success: true,
      symbol,
      timeframe,
      detectedCount: detectedZones.length,
      savedZones,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllZones,
  detectAndSaveZones,
};
