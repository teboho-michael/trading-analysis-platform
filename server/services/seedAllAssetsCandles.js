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

const seedAllAssetsCandles = async () => {
  try {
    const assetsResult = await pool.query(
      "SELECT id, symbol FROM assets ORDER BY id",
    );

    const priceMap = {
      US500: 6000,
      US100: 21000,
      XAUUSD: 3300,
      BTCUSD: 105000,
      USDJPY: 145,
    };

    for (const asset of assetsResult.rows) {
      const startPrice = priceMap[asset.symbol];

      await insertCandles(asset.id, "H1", 220, startPrice, 2, 1);
      await insertCandles(asset.id, "H4", 220, startPrice - 100, 3, 4);
      await insertCandles(asset.id, "D1", 220, startPrice - 200, 4, 24);

      console.log(`${asset.symbol} seeded successfully`);
    }

    console.log("All assets seeded successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedAllAssetsCandles();
