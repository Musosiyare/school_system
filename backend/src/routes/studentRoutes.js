const router = require("express").Router();
const { createStudent, updateStudent, deleteStudent, setStudentStatus, getStudentRosterPdf } = require("../controllers/studentController");
const { setRemark } = require("../controllers/remarkController");
const {
  getStudentReport,
  getStudentReportPdf,
  getStudentProgress,
} = require("../controllers/reportController");
const {
  generateOne: generatePortalCredential,
  peekTempPassword: peekPortalTempPassword,
  setStatus: setPortalStatus,
} = require("../controllers/portalCredentialController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

// Placed ahead of the "/:studentId" routes below so "roster" is never
// matched as a student id.
router.get("/roster/pdf", authorize("manager"), getStudentRosterPdf);

router.post("/", authorize("manager"), createStudent);
router.put("/:studentId", authorize("manager"), updateStudent);
router.patch("/:studentId/status", authorize("manager"), setStudentStatus);
router.delete("/:studentId", authorize("manager"), deleteStudent);
router.put("/:studentId/remarks/:termId", authorize("manager", "teacher"), setRemark);

router.get("/:studentId/term/:termId/report", authorize("manager", "teacher"), getStudentReport);
router.get(
  "/:studentId/term/:termId/report/pdf",
  authorize("manager", "teacher"),
  getStudentReportPdf
);
router.get("/:studentId/progress", authorize("manager", "teacher"), getStudentProgress);

// Student portal login credentials — manager can manage any student in the
// school; a teacher is further scoped (inside the controller) to only
// students in a class where they're the class teacher.
router.post(
  "/:studentId/portal-credentials/generate",
  authorize("manager", "teacher"),
  generatePortalCredential
);
router.get(
  "/:studentId/portal-credentials/peek",
  authorize("manager", "teacher"),
  peekPortalTempPassword
);
router.patch(
  "/:studentId/portal-credentials/status",
  authorize("manager", "teacher"),
  setPortalStatus
);

module.exports = router;
