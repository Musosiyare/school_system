const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User, School } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { getMaintenanceFlag } = require("./settingsController");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, schoolId: user.schoolId, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    // A session lasts this long before the person is forced to log in again.
    // Logout (see logout() below) is what actually ends a session in the
    // normal case — it bumps tokenVersion so the token stops working right
    // away, even though the JWT itself hasn't expired. This expiresIn value
    // is just the outer safety ceiling for a token nobody ever logs out of
    // (e.g. a tab left open). Default is long (30 days) so in practice
    // logging out is what ends your session, not a timer.
    //
    // If sessions are still ending sooner than this, the actual cause is the
    // JWT_EXPIRES_IN set in your real backend/.env file (not this fallback,
    // and not .env.example — .env is untracked, so an old short value like
    // "15m" or "1h" can linger there even after this default changes). Check
    // that file and update/remove that line.
    { expiresIn: process.env.JWT_EXPIRES_IN || "30d" }
  );
}

const login = asyncHandler(async (req, res) => {
  // Accept either field name: `identifier` (new) or `email` (legacy callers/
  // older frontend builds still posting { email, password }). Either one may
  // actually contain an email address or a phone number.
  const identifier = (req.body.identifier ?? req.body.email ?? "").trim();
  const { password } = req.body;
  if (!identifier || !password) {
    throw ApiError.badRequest("Email/phone and password are required");
  }

  const { Op } = require("sequelize");
  const user = await User.findOne({
    where: { [Op.or]: [{ email: identifier }, { phone: identifier }] },
  });
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Check the password before revealing anything about account/school status.
  // Otherwise an attacker could probe emails without a valid password and use
  // the distinct "deactivated" / "suspended" messages to enumerate accounts.
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Only after the password is confirmed do we distinguish "wrong credentials"
  // from other reasons access is currently blocked — maintenance mode included.
  // Superusers are exempt so there's always a way to get in and switch it off.
  if (user.role !== "superuser") {
    const flag = await getMaintenanceFlag();
    if (flag.maintenanceMode) {
      throw ApiError.maintenance(flag.message);
    }
  }

  if (user.status !== "active") {
    throw ApiError.unauthorized(
      "Your account has been deactivated. Please contact your school administrator."
    );
  }

  // A user's own account being active isn't enough — if their school has been
  // suspended by the superuser, nobody in that school (including the manager)
  // may log in, until the school is reactivated.
  let school = null;
  if (user.schoolId) {
    school = await School.findByPk(user.schoolId);
    if (!school || school.status !== "active") {
      throw ApiError.unauthorized(
        "This school's account has been suspended. Please contact the platform administrator."
      );
    }
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      schoolName: school?.name || null,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw ApiError.badRequest("New password must be at least 8 characters", "newPassword");
  }

  const user = await User.findByPk(req.user.id);
  if (!user) throw ApiError.notFound("User not found");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  // The user is changing their own password right now, so the recoverable
  // temp password on file is no longer valid/needed — clear it, and record
  // when this happened for audit purposes.
  user.tempPasswordEncrypted = null;
  user.tempPasswordSetAt = null;
  user.tempPasswordSetBy = null;
  user.passwordChangedAt = new Date();
  await user.save();

  res.json({ message: "Password updated successfully" });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ["id", "name", "email", "role", "schoolId", "mustChangePassword"],
  });
  const school = user.schoolId ? await School.findByPk(user.schoolId, { attributes: ["name"] }) : null;
  res.json({ user: { ...user.toJSON(), schoolName: school?.name || null } });
});

// PATCH /api/auth/me — self-service profile update. Name and email; role
// changes go through the manager/superuser admin flows instead, since those
// affect permissions rather than identity/contact info.
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !name.trim()) {
    throw ApiError.badRequest("Name is required", "name");
  }

  const user = await User.findByPk(req.user.id);
  if (!user) throw ApiError.notFound("User not found");

  if (email !== undefined) {
    // Self-service email changes are superuser-only. Managers/teachers get
    // their email set by whoever created their account (manager/superuser);
    // letting them change it themselves would let a suspended/departing
    // staff member quietly redirect their own login identity.
    if (req.user.role !== "superuser") {
      throw ApiError.forbidden("Only a superuser can change their own email");
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw ApiError.badRequest("Email is required", "email");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw ApiError.badRequest("Enter a valid email address", "email");
    }
    if (trimmedEmail !== user.email) {
      const existing = await User.findOne({ where: { email: trimmedEmail } });
      if (existing && existing.id !== user.id) {
        throw ApiError.conflict("A user with this email already exists", "email");
      }
      user.email = trimmedEmail;
    }
  }

  user.name = name.trim();
  await user.save();

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// Step 1 of "forgot password" — POST /api/auth/forgot-password/verify-name.
// Superuser only (see note below). Confirms a superuser account exists with
// this name before moving on to the email step.
const verifyForgotPasswordName = asyncHandler(async (req, res) => {
  const name = (req.body.name ?? "").trim();
  if (!name) {
    throw ApiError.badRequest("Name is required", "name");
  }

  const { Op } = require("sequelize");
  const user = await User.findOne({
    where: { role: "superuser", name: { [Op.like]: name } },
  });

  if (!user) {
    throw ApiError.notFound("No super admin account found with that name");
  }

  res.json({ verified: true });
});

// Step 2 — POST /api/auth/forgot-password/verify-email. Confirms the email
// belongs to the SAME account as the name from step 1, then sends the reset
// link. This is deliberately scoped to superuser accounts only: managers and
// teachers already have an admin above them (superuser/manager) who can
// reset their password directly from the admin screens, so this self-service
// flow only needs to cover the one role with nobody above it.
const verifyForgotPasswordEmail = asyncHandler(async (req, res) => {
  const name = (req.body.name ?? "").trim();
  const email = (req.body.email ?? "").trim().toLowerCase();
  if (!name || !email) {
    throw ApiError.badRequest("Name and email are required");
  }

  const { Op } = require("sequelize");
  const user = await User.findOne({
    where: { role: "superuser", name: { [Op.like]: name } },
  });

  if (!user || user.email.toLowerCase() !== email) {
    throw ApiError.badRequest("That email doesn't match the account we found", "email");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetTokenHash = hashResetToken(rawToken);
  user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetLink);

  res.json({ verified: true, message: "Reset link sent to your email." });
});

// POST /api/auth/reset-password — completes the flow above. Also bumps
// tokenVersion so any session started before the reset (e.g. by whoever
// requested it, or an attacker who had the old password) is signed out.
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    throw ApiError.badRequest("Token and new password are required");
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest("New password must be at least 8 characters", "newPassword");
  }

  const tokenHash = hashResetToken(token);
  const { Op } = require("sequelize");
  const user = await User.findOne({
    where: {
      resetTokenHash: tokenHash,
      role: "superuser",
      resetTokenExpiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw ApiError.badRequest("This reset link is invalid or has expired");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.tempPasswordEncrypted = null;
  user.tempPasswordSetAt = null;
  user.tempPasswordSetBy = null;
  user.passwordChangedAt = new Date();
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.tokenVersion += 1;
  await user.save();

  res.json({ message: "Password updated successfully. You can now sign in." });
});

// POST /api/auth/logout — ends the session server-side.
// JWTs are stateless, so simply deleting the token on the client isn't enough:
// the same token would still be accepted by the API until it naturally expires.
// Bumping tokenVersion here invalidates every token issued before this call,
// so a logged-out token is rejected by authenticate() immediately.
const logout = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user) {
    user.tokenVersion += 1;
    await user.save();
  }
  res.json({ message: "Logged out" });
});

module.exports = {
  login,
  changePassword,
  me,
  updateProfile,
  logout,
  verifyForgotPasswordName,
  verifyForgotPasswordEmail,
  resetPassword,
};
