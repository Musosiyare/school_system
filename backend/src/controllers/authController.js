const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, School } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

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
  const { email, password } = req.body;
  if (!email || !password) {
    throw ApiError.badRequest("Email and password are required");
  }

  const user = await User.findOne({ where: { email } });
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
  // from "correct credentials, but this account has been deactivated".
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

// PATCH /api/auth/me — self-service profile update. Currently just the
// display name; email/role changes go through the manager/superuser admin
// flows instead, since those affect login and permissions.
const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw ApiError.badRequest("Name is required", "name");
  }

  const user = await User.findByPk(req.user.id);
  if (!user) throw ApiError.notFound("User not found");

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

module.exports = { login, changePassword, me, updateProfile, logout };
