const router = require("express").Router();
const {
  createAcademicYear,
  listAcademicYears,
  setCurrentAcademicYear,
} = require("../controllers/academicYearController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createAcademicYear);
router.get("/", authorize("manager", "teacher"), listAcademicYears);
router.patch("/:id/set-current", authorize("manager"), setCurrentAcademicYear);

module.exports = router;
