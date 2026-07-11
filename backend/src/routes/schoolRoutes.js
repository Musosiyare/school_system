const router = require("express").Router();
const {
  createSchool,
  listSchools,
  updateSchoolStatus,
  resetManagerCredentials,
  getManagerTempPassword,
  getMySchool,
  updateMySchool,
  getPlatformStats,
} = require("../controllers/schoolController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate);

// Manager: view/update their own school's profile (name, contact info, logo).
// Placed before the superuser "/:id" routes so "me" is never matched as an id.
router.get("/me", authorize("manager"), scopeToSchool, getMySchool);
router.patch("/me", authorize("manager"), scopeToSchool, updateMySchool);

// Superuser: manage all schools across the platform.
router.post("/", authorize("superuser"), createSchool);
router.get("/", authorize("superuser"), listSchools);
router.get("/stats", authorize("superuser"), getPlatformStats);
router.patch("/:id", authorize("superuser"), updateSchoolStatus);
router.get("/:id/manager-temp-password", authorize("superuser"), getManagerTempPassword);
// Kept as a fallback for when a manager has already changed their password
// and forgotten the new one (temp-password recovery no longer applies then).
router.post("/:id/reset-manager-credentials", authorize("superuser"), resetManagerCredentials);

module.exports = router;
