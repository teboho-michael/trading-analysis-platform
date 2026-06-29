const cron = require("node-cron");
const { runMarketScan } = require("./marketScanner");

const startMarketScanner = () => {
  const expression = process.env.SCAN_CRON || "*/5 * * * *";
  console.log(`Market scanner scheduler initialized (${expression})`);

  cron.schedule(expression, async () => {
    console.log("Running scheduled market scan...");

    try {
      const results = await runMarketScan("scheduled");

      console.log("Scheduled market scan completed");
      console.log({
        scanRunId: results.scanRun.id,
        status: results.scanRun.status,
        totalCollections: results.scanRun.total_collections,
        successfulCollections: results.scanRun.successful_collections,
        failedCollections: results.scanRun.failed_collections,
        signalsCreated: results.scanRun.signals_created,
      });
    } catch (error) {
      console.error("Scheduled market scan failed:", error.message);
    }
  });
};

module.exports = {
  startMarketScanner,
};
