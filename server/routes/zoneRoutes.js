const express = require("express");
const router = express.Router();

const {
  getAllZones,
  detectAndSaveZones,
} = require("../controllers/zoneController");

router.get("/", getAllZones);
router.get("/detect/:symbol/:timeframe", detectAndSaveZones);

module.exports = router;
