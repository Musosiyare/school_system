const router = require("express").Router();
const {
  createTeacher,
  listTeachers,
  getTeacherTempPassword,
  updateTeacherStatus,
} = require("../controllers/teacherController");
const { listTeacherAssignments } = require("../controllers/assignmentController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createTeacher);
router.get("/", authorize("manager"), listTeachers);
router.get("/:id/temp-password", authorize("manager"), getTeacherTempPassword);
router.patch("/:id/status", authorize("manager"), updateTeacherStatus);
router.get("/:id/assignments", authorize("manager", "teacher"), listTeacherAssignments);

module.exports = router;
