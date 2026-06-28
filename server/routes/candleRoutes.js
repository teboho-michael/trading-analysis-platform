const express = require("express");
const router = express.Router();

const {
  getAllCandles,
  getCandlesByAssetAndTimeframe,
  addCandle,
} = require("../controllers/candleController");

router.get("/", getAllCandles);
router.get("/:symbol/:timeframe", getCandlesByAssetAndTimeframe);
router.post("/", addCandle);

module.exports = router;
