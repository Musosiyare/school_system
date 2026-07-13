const router = require("express").Router();
const { getSchoolStatistics } = require("../controllers/statisticsController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.get("/", authorize("manager"), getSchoolStatistics);

module.exports = router;
