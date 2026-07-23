const router = require("express").Router();
const {
  createTeacher,
  listTeachers,
  getTeacherTempPassword,
  resetTeacherPassword,
  updateTeacher,
  updateTeacherStatus,
  deleteTeacher,
} = require("../controllers/teacherController");
const { listTeacherAssignments } = require("../controllers/assignmentController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createTeacher);
router.get("/", authorize("manager"), listTeachers);
router.patch("/:id", authorize("manager"), updateTeacher);
router.get("/:id/temp-password", authorize("manager"), getTeacherTempPassword);
// Kept as a fallback for when a teacher has already changed their password
// and forgotten the new one (temp-password recovery no longer applies then).
router.post("/:id/reset-password", authorize("manager"), resetTeacherPassword);
router.patch("/:id/status", authorize("manager"), updateTeacherStatus);
router.delete("/:id", authorize("manager"), deleteTeacher);
router.get("/:id/assignments", authorize("manager", "teacher"), listTeacherAssignments);

module.exports = router;
