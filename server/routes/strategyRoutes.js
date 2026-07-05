const router = require("express").Router();
const controller = require("../controllers/strategyController");

router.get("/", controller.list);
router.get("/:id", controller.get);

module.exports = router;
