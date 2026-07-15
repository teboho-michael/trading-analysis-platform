const router = require("express").Router();
const controller = require("../controllers/brokerController");

router.get("/mt5/symbol-map", controller.getMt5SymbolMap);
router.post("/mt5/candles/import", controller.importMt5Candles);
router.post("/mt5/ticks/import", controller.importMt5Ticks);

module.exports = router;
