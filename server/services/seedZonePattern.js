const pool = require("../db/connection");

const seedZonePattern = async () => {
  try {
    const assetResult = await pool.query(
      "SELECT id FROM assets WHERE symbol = $1",
      ["US500"],
    );

    const assetId = assetResult.rows[0].id;

    const now = new Date();

    const candles = [
      {
        open: 6200,
        high: 6210,
        low: 6195,
        close: 6205,
        candle_time: new Date(now.getTime() - 3 * 4 * 60 * 60 * 1000),
      },
      {
        open: 6204,
        high: 6212,
        low: 6198,
        close: 6206,
        candle_time: new Date(now.getTime() - 2 * 4 * 60 * 60 * 1000),
      },
      {
        open: 6208,
        high: 6285,
        low: 6205,
        close: 6275,
        candle_time: new Date(now.getTime() - 1 * 4 * 60 * 60 * 1000),
      },
    ];

    for (const candle of candles) {
      await pool.query(
        `
                INSERT INTO candles
                (asset_id, timeframe, open, high, low, close, volume, candle_time)
                VALUES ($1, 'H4', $2, $3, $4, $5, 1000, $6)
                `,
        [
          assetId,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.candle_time,
        ],
      );
    }

    console.log("Demand zone pattern inserted for US500 H4");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedZonePattern();
