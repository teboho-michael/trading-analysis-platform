const router = require("express").Router();
const controller = require("../controllers/researchController");
router.get("/intelligence", controller.intelligence);
module.exports = router;
