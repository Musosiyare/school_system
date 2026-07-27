const router = require("express").Router();
const {
  createDisciplineStaff,
  listDisciplineStaff,
  updateDisciplineStaff,
  updateStandaloneDisciplineRole,
  updateDisciplineStaffStatus,
  getDisciplineStaffTempPassword,
  resetDisciplineStaffPassword,
  deleteDisciplineStaff,
  listTaggableStaff,
  updateTaggedDisciplineRole,
} = require("../controllers/disciplineStaffController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool, authorize("manager"));

// Standalone SBMS-only accounts
router.post("/", createDisciplineStaff);
router.get("/", listDisciplineStaff);
router.patch("/:id", updateDisciplineStaff);
router.patch("/:id/role", updateStandaloneDisciplineRole);
router.patch("/:id/status", updateDisciplineStaffStatus);
router.get("/:id/temp-password", getDisciplineStaffTempPassword);
router.post("/:id/reset-password", resetDisciplineStaffPassword);
router.delete("/:id", deleteDisciplineStaff);

// Tagging an existing teacher/manager as discipline staff
router.get("/taggable", listTaggableStaff);
router.patch("/tag/:userId", updateTaggedDisciplineRole);

module.exports = router;
