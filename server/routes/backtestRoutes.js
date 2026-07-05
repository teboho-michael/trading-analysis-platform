const router = require("express").Router();
const controller = require("../controllers/backtestController");

router.get("/", controller.list);
router.post("/run", controller.run);
router.get("/:id/results", controller.results);
router.get("/:id", controller.get);

module.exports = router;
