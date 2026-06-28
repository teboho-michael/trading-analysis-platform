const express = require("express");
const router = express.Router();

const {
  collectMarketData,
  scanMarket,
} = require("../controllers/marketController");

router.post("/collect", collectMarketData);
router.post("/scan", scanMarket);

module.exports = router;
