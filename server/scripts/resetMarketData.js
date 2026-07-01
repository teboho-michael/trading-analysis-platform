const pool = require("../db/connection");

const resetMarketData = async () => {
  if (!process.argv.includes("--confirm")) {
    const counts = await pool.query(`SELECT (SELECT COUNT(*) FROM candles)::int AS candles, (SELECT COUNT(*) FROM zones)::int AS zones, (SELECT COUNT(*) FROM signals)::int AS signals`);
    console.log("Dry run only. No data deleted.", counts.rows[0], "Pass --confirm to reset market data; assets are always preserved.");
    console.log("Use npm run reset:market-data -- --confirm when changing US500/US100 between proxy-scale ETF data and direct index-scale data, then recollect candles for the active mapping.");
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM alert_events");
    const signals = await client.query("DELETE FROM signals RETURNING id");
    const zones = await client.query("DELETE FROM zones RETURNING id");
    const candles = await client.query("DELETE FROM candles RETURNING id");

    await client.query("COMMIT");

    console.log(
      `Market data reset complete: ${signals.rowCount} signals, ${zones.rowCount} zones, ${candles.rowCount} candles deleted. Assets and scan history were preserved.`,
    );
    console.log("Recollect market data before trusting watchlist prices, setup levels, zones, or validation reports for the active source mapping.");
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
