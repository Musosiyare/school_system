const router = require("express").Router();
const { search } = require("../controllers/searchController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

// GET /api/search?q=... — manager-only, same audience as /manager/students
// and /manager/teachers, which is where each result links back into.
router.get("/", authorize("manager"), search);

module.exports = router;
