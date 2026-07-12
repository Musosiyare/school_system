const router = require("express").Router();
const {
  login,
  changePassword,
  me,
  updateProfile,
  logout,
  verifyForgotPasswordName,
  verifyForgotPasswordEmail,
  resetPassword,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", login);
router.post("/forgot-password/verify-name", verifyForgotPasswordName);
router.post("/forgot-password/verify-email", verifyForgotPasswordEmail);
router.post("/reset-password", resetPassword);
router.post("/logout", authenticate, logout);
router.post("/change-password", authenticate, changePassword);
router.get("/me", authenticate, me);
router.patch("/me", authenticate, updateProfile);

module.exports = router;
