const pool = require("../db/connection");

const seedCandles = async () => {
  try {
    const assetResult = await pool.query(
      "SELECT id FROM assets WHERE symbol = $1",
      ["US500"],
    );

    const assetId = assetResult.rows[0].id;

    for (let i = 0; i < 220; i++) {
      const basePrice = 6000 + i * 2;
      const candleTime = new Date();
      candleTime.setHours(candleTime.getHours() - (220 - i));

      await pool.query(
        `
                INSERT INTO candles 
                (asset_id, timeframe, open, high, low, close, volume, candle_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
        [
          assetId,
          "H1",
          basePrice,
          basePrice + 10,
          basePrice - 10,
          basePrice + 5,
          1000,
          candleTime,
        ],
      );
    }

    console.log("220 US500 H1 candles inserted successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedCandles();
