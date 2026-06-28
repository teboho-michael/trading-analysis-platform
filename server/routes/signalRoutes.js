const express = require("express");
const router = express.Router();

const { getAllSignals, addSignal } = require("../controllers/signalController");

router.get("/", getAllSignals);
router.post("/", addSignal);

module.exports = router;
