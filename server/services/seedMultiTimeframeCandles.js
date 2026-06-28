const pool = require("../db/connection");

const insertCandles = async (
  assetId,
  timeframe,
  count,
  startPrice,
  step,
  hoursGap,
) => {
  for (let i = 0; i < count; i++) {
    const basePrice = startPrice + i * step;

    const candleTime = new Date();
    candleTime.setHours(candleTime.getHours() - (count - i) * hoursGap);

    await pool.query(
      `
            INSERT INTO candles
            (asset_id, timeframe, open, high, low, close, volume, candle_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
      [
        assetId,
        timeframe,
        basePrice,
        basePrice + 10,
        basePrice - 10,
        basePrice + 5,
        1000,
        candleTime,
      ],
    );
  }
};

const seedMultiTimeframeCandles = async () => {
  try {
    const assetResult = await pool.query(
      "SELECT id FROM assets WHERE symbol = $1",
      ["US500"],
    );

    const assetId = assetResult.rows[0].id;

    await insertCandles(assetId, "H1", 220, 6000, 2, 1);
    await insertCandles(assetId, "H4", 220, 5900, 3, 4);
    await insertCandles(assetId, "D1", 220, 5800, 4, 24);

    console.log("US500 H1, H4, and D1 candles inserted successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedMultiTimeframeCandles();
