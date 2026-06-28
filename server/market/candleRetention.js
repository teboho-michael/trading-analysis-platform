const pool = require("../db/connection");

const getCandleRetentionLimit = () => {
  return Number(process.env.CANDLE_RETENTION_LIMIT || 300);
};

const cleanupOldCandles = async () => {
  const retentionLimit = getCandleRetentionLimit();

  const result = await pool.query(
    `
        DELETE FROM candles c
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY asset_id, timeframe
                       ORDER BY candle_time DESC
                   ) AS row_num
            FROM candles
        ) ranked
        WHERE c.id = ranked.id
        AND ranked.row_num > $1
        RETURNING c.id
        `,
    [retentionLimit],
  );

  return {
    retentionLimit,
    deletedCandles: result.rows.length,
  };
};

module.exports = {
  cleanupOldCandles,
};
