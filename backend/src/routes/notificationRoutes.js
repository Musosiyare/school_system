const router = require("express").Router();
const {
  sendNotification,
  listMyNotifications,
  listSentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { authenticate, authorize, scopeToSchool } = require("../middleware/auth");

router.use(authenticate, scopeToSchool);

router.post("/", authorize("teacher", "manager"), sendNotification);
router.get("/sent", authorize("teacher", "manager"), listSentNotifications);
router.get("/", authorize("teacher", "manager"), listMyNotifications);
router.patch("/read-all", authorize("teacher", "manager"), markAllNotificationsRead);
router.patch("/:id/read", authorize("teacher", "manager"), markNotificationRead);

module.exports = router;
