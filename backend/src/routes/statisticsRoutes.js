const router = require("express").Router();
const { getSchoolStatistics, getSchoolNumbersReportPdf, getYearsComparison, getTeacherStatistics } = require("../controllers/statisticsController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.get("/", authorize("manager"), getSchoolStatistics);
router.get("/years-comparison", authorize("manager"), getYearsComparison);
router.get("/report/pdf", authorize("manager"), getSchoolNumbersReportPdf);
router.get("/teacher", authorize("teacher"), getTeacherStatistics);

module.exports = router;
