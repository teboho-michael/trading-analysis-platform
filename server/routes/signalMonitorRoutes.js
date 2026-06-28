const express = require("express");
const router = express.Router();

const { getSignalMonitor } = require("../controllers/signalMonitorController");

router.get("/", getSignalMonitor);

module.exports = router;
