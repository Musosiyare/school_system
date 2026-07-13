const router = require("express").Router();
const { createStudent, updateStudent, deleteStudent, getStudentRosterPdf } = require("../controllers/studentController");
const { setRemark } = require("../controllers/remarkController");
const {
  getStudentReport,
  getStudentReportPdf,
  getStudentProgress,
} = require("../controllers/reportController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

// Placed ahead of the "/:studentId" routes below so "roster" is never
// matched as a student id.
router.get("/roster/pdf", authorize("manager"), getStudentRosterPdf);

router.post("/", authorize("manager"), createStudent);
router.put("/:studentId", authorize("manager"), updateStudent);
router.delete("/:studentId", authorize("manager"), deleteStudent);
router.put("/:studentId/remarks/:termId", authorize("manager", "teacher"), setRemark);

router.get("/:studentId/term/:termId/report", authorize("manager", "teacher"), getStudentReport);
router.get(
  "/:studentId/term/:termId/report/pdf",
  authorize("manager", "teacher"),
  getStudentReportPdf
);
router.get("/:studentId/progress", authorize("manager", "teacher"), getStudentProgress);

module.exports = router;
