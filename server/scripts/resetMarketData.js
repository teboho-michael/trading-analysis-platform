const pool = require("../db/connection");

const resetMarketData = async () => {
  if (!process.argv.includes("--confirm")) {
    throw new Error(
      "Reset not run. Pass --confirm to delete signals, zones, and candles.",
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const signals = await client.query("DELETE FROM signals RETURNING id");
    const zones = await client.query("DELETE FROM zones RETURNING id");
    const candles = await client.query("DELETE FROM candles RETURNING id");

    await client.query("COMMIT");

    console.log(
      `Market data reset complete: ${signals.rowCount} signals, ${zones.rowCount} zones, ${candles.rowCount} candles deleted. Assets and scan history were preserved.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

resetMarketData().catch(async (error) => {
  console.error(error.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
