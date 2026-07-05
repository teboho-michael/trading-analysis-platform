const router = require("express").Router();
const controller = require("../controllers/journalController");
router.get("/stats", controller.stats);
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/from-signal/:signalId", controller.fromSignal);
router.post("/", controller.create);
router.patch("/:id/outcome", controller.updateOutcome);
module.exports = router;
