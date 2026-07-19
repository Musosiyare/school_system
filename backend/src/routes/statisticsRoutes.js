const router = require("express").Router();
const { getSchoolStatistics, getSchoolNumbersReportPdf, getYearsComparison } = require("../controllers/statisticsController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.get("/", authorize("manager"), getSchoolStatistics);
router.get("/years-comparison", authorize("manager"), getYearsComparison);
router.get("/report/pdf", authorize("manager"), getSchoolNumbersReportPdf);

module.exports = router;
