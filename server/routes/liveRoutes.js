const express = require("express");
const { getPrices } = require("../controllers/liveController");
const router = express.Router();
router.get("/prices", getPrices);
module.exports = router;
