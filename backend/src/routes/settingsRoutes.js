const router = require("express").Router();
const { getMaintenanceStatus, updateMaintenanceMode } = require("../controllers/settingsController");
const { authenticate, authorize } = require("../middleware/auth");

// Public — no auth. The login screen and every client (logged in or not)
// need to be able to check this before/without a valid session.
router.get("/maintenance", getMaintenanceStatus);

router.use(authenticate);
router.patch("/maintenance", authorize("superuser"), updateMaintenanceMode);

module.exports = router;
