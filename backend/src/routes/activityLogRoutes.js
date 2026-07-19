const router = require("express").Router();
const { listMyActivity } = require("../controllers/activityLogController");
const { authenticate } = require("../middleware/auth");

// No scopeToSchool and no authorize() here on purpose — every role
// (superuser included, who has no schoolId) can see their own activity,
// and the controller only ever queries by req.user.id.
router.use(authenticate);
router.get("/", listMyActivity);

module.exports = router;
