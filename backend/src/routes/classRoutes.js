const router = require("express").Router();
const {
  createClass,
  listClasses,
  getClass,
  setClassModules,
  assignClassTeacher,
  getIncompleteMarks,
} = require("../controllers/classController");
const { listStudentsByClass, createStudent, getClassStudentListPdf } = require("../controllers/studentController");
const { getClassReport, getClassReportPdf } = require("../controllers/reportController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createClass);
router.get("/", authorize("manager", "teacher"), listClasses);
router.get("/:id", authorize("manager", "teacher"), getClass);
router.put("/:id/modules", authorize("manager"), setClassModules);
router.post("/:id/assign-teacher", authorize("manager"), assignClassTeacher);

router.get("/:id/incomplete-marks", authorize("manager", "teacher"), getIncompleteMarks);

router.get("/:id/students", authorize("manager", "teacher"), listStudentsByClass);
router.get("/:id/students/pdf", authorize("manager"), getClassStudentListPdf);

router.get("/:classId/term/:termId/report", authorize("manager", "teacher"), getClassReport);
router.get("/:classId/term/:termId/report/pdf", authorize("manager", "teacher"), getClassReportPdf);

module.exports = router;
