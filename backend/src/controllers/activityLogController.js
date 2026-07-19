const { Op } = require("sequelize");
const { ActivityLog } = require("../models");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/activity-logs — the current user's own activity, newest first,
// with real server-side pagination (nothing is ever capped/hidden — you can
// always page back further, it just costs another request).
// Every role (superuser, manager, teacher) calls this same endpoint; it's
// always scoped to req.user.id, so there's no way to see anyone else's log.
//
// Optional query params:
//   page   — 1-based page number (default 1)
//   limit  — page size (default 8, capped at 50)
//   action — exact action code to filter by, e.g. "student.created"
//   from   — ISO date; only entries on/after this date
//   to     — ISO date; only entries on/before this date
//   q      — case-insensitive search within the description text
const listMyActivity = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 8));

  const where = { userId: req.user.id };

  if (req.query.action) where.action = req.query.action;

  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(`${req.query.from}T00:00:00`);
    if (req.query.to) where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59.999`);
  }

  if (req.query.q && req.query.q.trim()) {
    where.description = { [Op.like]: `%${req.query.q.trim()}%` };
  }

  const { rows, count } = await ActivityLog.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  res.json({
    logs: rows,
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  });
});

module.exports = { listMyActivity };
