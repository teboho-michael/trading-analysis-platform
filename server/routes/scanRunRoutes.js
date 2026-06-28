const express = require("express");
const router = express.Router();

const {
  getScanRuns,
  getLatestScanRun,
} = require("../controllers/scanRunController");

router.get("/", getScanRuns);
router.get("/latest", getLatestScanRun);

module.exports = router;
