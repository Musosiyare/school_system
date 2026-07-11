const router = require("express").Router();
const { createModule, listModules, updateModule, deleteModule } = require("../controllers/moduleController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createModule);
router.get("/", authorize("manager", "teacher"), listModules);
router.patch("/:id", authorize("manager"), updateModule);
router.delete("/:id", authorize("manager"), deleteModule);

module.exports = router;
