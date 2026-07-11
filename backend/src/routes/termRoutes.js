const router = require("express").Router();
const { setTermLock, listTermsForYear } = require("../controllers/termController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.patch("/:id/lock", authorize("manager"), setTermLock);
router.get("/year/:yearId", authorize("manager", "teacher"), listTermsForYear);

module.exports = router;
