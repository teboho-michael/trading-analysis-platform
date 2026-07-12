const express = require("express");
const { getInstruments, providerStatus, health, dataSources } = require("../controllers/systemController");
const router = express.Router();
router.get("/instruments", getInstruments);
router.get("/provider/status", providerStatus);
router.get("/health", health);
router.get("/data-sources", dataSources);
module.exports = router;
