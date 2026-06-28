const express = require("express");
const router = express.Router();

const {
  getEmaTrend,
  getTrendSignal,
  getTradeSetup,
} = require("../controllers/analysisController");

router.get("/ema/:symbol/:timeframe", getEmaTrend);
router.get("/trend/:symbol/:timeframe", getTrendSignal);
router.get("/setup/:symbol", getTradeSetup);

module.exports = router;
