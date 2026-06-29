const express = require("express");
const { getAlertHistory, getLatestAlerts } = require("../controllers/alertController");
const router = express.Router();
router.get("/history", getAlertHistory);
router.get("/latest", getLatestAlerts);
module.exports = router;
