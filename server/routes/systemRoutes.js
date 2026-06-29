const express = require("express");
const { getInstruments, providerStatus, health } = require("../controllers/systemController");
const router = express.Router();
router.get("/instruments", getInstruments);
router.get("/provider/status", providerStatus);
router.get("/health", health);
module.exports = router;
