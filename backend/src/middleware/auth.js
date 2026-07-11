const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { School, User } = require("../models");

/**
 * Verifies the JWT and attaches req.user = { id, role, schoolId }.
 * Every protected route must go through this first.
 *
 * Also enforces server-side session invalidation: each token carries the
 * tokenVersion it was issued with, and logout() bumps the user's stored
 * tokenVersion. If they no longer match, the token belongs to a session
 * that has since logged out, so it's rejected even though the JWT itself
 * hasn't expired yet.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(ApiError.unauthorized("Missing authentication token"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(payload.id, { attributes: ["id", "tokenVersion", "status"] });
    if (!user || user.status !== "active") {
      return next(ApiError.unauthorized("Session has ended. Please log in again."));
    }
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return next(ApiError.unauthorized("Session has ended. Please log in again."));
    }

    req.user = payload; // { id, role, schoolId, tokenVersion }
    next();
  } catch (err) {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
}

/**
 * Restricts a route to one or more roles.
 * Usage: authorize('manager', 'superuser')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}

/**
 * CRITICAL: never trust a school_id sent from the client.
 * This always derives the tenant scope from the authenticated user's token,
 * and attaches it to req.schoolId for controllers to use in every query.
 * Superuser routes do not use this (they operate across tenants).
 */
async function scopeToSchool(req, res, next) {
  if (!req.user || !req.user.schoolId) {
    return next(ApiError.forbidden("No school scope on this account"));
  }

  // A token can stay valid for hours. If the superuser suspends the school
  // partway through that window, every request for that school (from the
  // manager included) must stop working immediately, not just future logins.
  const school = await School.findByPk(req.user.schoolId);
  if (!school || school.status !== "active") {
    return next(ApiError.forbidden("This school's account has been suspended."));
  }

  req.schoolId = req.user.schoolId;
  next();
}

module.exports = { authenticate, authorize, scopeToSchool };
