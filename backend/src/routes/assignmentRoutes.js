const router = require("express").Router();
const {
  createAssignment,
  listAllAssignments,
  deleteAssignment,
  updateAssignment,
} = require("../controllers/assignmentController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("manager"), createAssignment);
router.get("/", authorize("manager"), listAllAssignments);
router.patch("/:id", authorize("manager"), updateAssignment);
router.delete("/:id", authorize("manager"), deleteAssignment);

module.exports = router;
