const router = require("express").Router();
const controller = require("../controllers/backtestController");

router.get("/", controller.list);
router.get("/readiness", controller.readiness);
router.post("/collect-required", controller.collectRequired);
router.post("/run", controller.run);
router.get("/:id/results", controller.results);
router.get("/:id", controller.get);

module.exports = router;
