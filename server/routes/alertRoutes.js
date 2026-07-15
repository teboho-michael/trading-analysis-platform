const express = require("express");
const { getAlertHistory, getLatestAlerts, acknowledgeAlert, resolveAlert } = require("../controllers/alertController");
const router = express.Router();
router.get("/history", getAlertHistory);
router.get("/latest", getLatestAlerts);
router.post("/:id/acknowledge", acknowledgeAlert);
router.post("/:id/resolve", resolveAlert);
module.exports = router;
