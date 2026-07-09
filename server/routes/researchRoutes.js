const router = require("express").Router();
const controller = require("../controllers/researchController");
router.get("/intelligence", controller.intelligence);
router.get("/conditions", controller.conditions);
router.get("/experiments", controller.experiments);
router.post("/experiments/run", controller.runExperiment);
router.get("/experiments/:id/results", controller.experimentResults);
router.get("/experiments/:id", controller.experiment);
module.exports = router;
