const { Op } = require("sequelize");
const { SystemSetting, User, Notification } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// A schedule is purely an advance notice to staff — it never flips
// maintenance mode on by itself. Once its time has passed it has nothing
// left to say, so it's cleared out automatically. Called every time the
// settings row is read, so it self-expires on the very next request/poll
// after the scheduled moment — no separate cron process required, though
// server.js also polls this directly on an interval as a backstop for
// periods with zero traffic.
async function expireSchedule(row) {
  if (row.scheduledAt && new Date(row.scheduledAt).getTime() <= Date.now()) {
    row.scheduledAt = null;
    row.scheduleAnnouncement = null;
    await row.save();
    invalidateMaintenanceFlagCache();
    await clearScheduleNotifications();
  }
}

// Always the same row (id = 1) — created on first read if it doesn't exist yet.
async function getSettingsRow() {
  const [row] = await SystemSetting.findOrCreate({ where: { id: 1 } });
  await expireSchedule(row);
  return row;
}

// Every authenticated request (see middleware/auth.js) and every login
// attempt needs to know whether maintenance mode is on, so this can't be a
// full DB round trip each time. Short-lived in-memory cache keeps that cheap
// while still picking up a toggle (or an auto-applied schedule) within a few
// seconds; updateMaintenanceMode/expireSchedule also clear it immediately
// so a change takes effect on the very next request instead of waiting out
// the TTL.
let flagCache = null;
let flagCacheExpiresAt = 0;
const FLAG_CACHE_TTL_MS = 5000;

async function getMaintenanceFlag() {
  const now = Date.now();
  if (flagCache && now < flagCacheExpiresAt) return flagCache;
  const row = await getSettingsRow();
  flagCache = {
    maintenanceMode: row.maintenanceMode,
    title: row.maintenanceTitle,
    message: row.maintenanceMessage,
  };
  flagCacheExpiresAt = now + FLAG_CACHE_TTL_MS;
  return flagCache;
}

function invalidateMaintenanceFlagCache() {
  flagCache = null;
  flagCacheExpiresAt = 0;
}

function serialize(row) {
  return {
    maintenanceMode: row.maintenanceMode,
    title: row.maintenanceTitle,
    message: row.maintenanceMessage,
    updatedByName: row.updatedByName,
    updatedAt: row.updatedAt,
    scheduledAt: row.scheduledAt,
    scheduleAnnouncement: row.scheduleAnnouncement,
  };
}

function formatScheduleWhen(date) {
  return new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

// The heads-up text is generated purely from the date/time picked — the
// superuser never types a message for this, they just pick when.
function buildScheduleAnnouncement(scheduledAt) {
  return `Maintenance is planned for ${formatScheduleWhen(scheduledAt)}. Please save your work before then.`;
}

// Drops a notification into every active teacher/manager's bell (the same
// mechanism used for "please finish recording marks" reminders) so the
// scheduled window isn't just a banner someone could miss — it's also a
// message they were explicitly sent. Tagged with source so it can be found
// and cleared as a batch later (see clearScheduleNotifications).
async function notifyAllStaffOfSchedule(actingUserId, scheduledAt) {
  const staff = await User.findAll({
    where: { role: { [Op.in]: ["teacher", "manager"] }, status: "active", schoolId: { [Op.ne]: null } },
    attributes: ["id", "schoolId"],
  });
  if (staff.length === 0) return;

  const message = `Upcoming maintenance: the system is expected to go offline starting ${formatScheduleWhen(
    scheduledAt
  )}.`;

  await Notification.bulkCreate(
    staff.map((u) => ({
      schoolId: u.schoolId,
      senderId: actingUserId,
      recipientId: u.id,
      message,
      source: "maintenance_schedule",
    }))
  );
}

// Removes every notification sent by notifyAllStaffOfSchedule — called the
// moment the notification is turned off, cancelled early, superseded by
// maintenance mode actually switching on, or left to expire on its own once
// the scheduled time passes. Read or unread, it's no longer relevant, so it's
// deleted outright rather than just marked read.
async function clearScheduleNotifications() {
  await Notification.destroy({ where: { source: "maintenance_schedule" } });
}

// GET /api/settings/maintenance — public, no auth. Both the login screen (to
// warn people before they try) and every logged-in session (to know whether
// to show the maintenance screen, or an upcoming-schedule heads-up) need this
// without necessarily having a valid token yet.
const getMaintenanceStatus = asyncHandler(async (req, res) => {
  const row = await getSettingsRow();
  res.json(serialize(row));
});

// PATCH /api/settings/maintenance — superuser only.
// Handles two things in one call, since a superuser's draft form can touch
// either or both at once:
//   1. Turning maintenance on/off right now (maintenanceMode, title, message)
//   2. Toggling an advance notification for a future window (scheduledAt) —
//      this is a heads-up notification only, it never turns maintenance mode
//      on by itself, its message is auto-generated from the date/time picked,
//      it's sent to every active teacher/manager the moment it's set, and it
//      self-expires once the time passes. Pass scheduledAt: null to cancel a
//      pending notification early.
const updateMaintenanceMode = asyncHandler(async (req, res) => {
  const { maintenanceMode, title, message, scheduledAt } = req.body;

  if (typeof maintenanceMode !== "boolean") {
    throw ApiError.badRequest("maintenanceMode must be true or false", "maintenanceMode");
  }
  if (title !== undefined && !title.trim()) {
    throw ApiError.badRequest("Title cannot be empty", "title");
  }
  if (message !== undefined && !message.trim()) {
    throw ApiError.badRequest("Message cannot be empty", "message");
  }

  // scheduledAt: undefined = leave untouched, null = clear any pending
  // notification, a date string = set/replace it (must be in the future).
  let nextScheduledAt;
  if (scheduledAt === null) {
    nextScheduledAt = null;
  } else if (scheduledAt !== undefined) {
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      throw ApiError.badRequest("Invalid scheduled date/time", "scheduledAt");
    }
    if (parsed.getTime() <= Date.now()) {
      throw ApiError.badRequest("Scheduled time must be in the future", "scheduledAt");
    }
    nextScheduledAt = parsed;
  }

  const row = await getSettingsRow();
  const actingUser = await User.findByPk(req.user.id, { attributes: ["name"] });

  row.maintenanceMode = maintenanceMode;
  if (title !== undefined) row.maintenanceTitle = title.trim();
  if (message !== undefined) row.maintenanceMessage = message.trim();

  if (nextScheduledAt !== undefined) {
    row.scheduledAt = nextScheduledAt;
    row.scheduleAnnouncement = nextScheduledAt ? buildScheduleAnnouncement(nextScheduledAt) : null;
  }
  // Turning maintenance on right now makes any pending future notification moot.
  const scheduleSuperseded = maintenanceMode && row.scheduledAt;
  if (maintenanceMode) {
    row.scheduledAt = null;
    row.scheduleAnnouncement = null;
  }

  row.updatedByName = actingUser?.name || null;
  await row.save();
  invalidateMaintenanceFlagCache();

  if (nextScheduledAt) {
    await notifyAllStaffOfSchedule(req.user.id, nextScheduledAt);
  } else if (nextScheduledAt === null || scheduleSuperseded) {
    // Explicit cancel (nextScheduledAt === null) or maintenance mode turning
    // on right over a pending notification — either way it's no longer
    // relevant, so clear it out of everyone's bell.
    await clearScheduleNotifications();
  }

  res.json(serialize(row));
});

module.exports = {
  getMaintenanceStatus,
  updateMaintenanceMode,
  getSettingsRow,
  getMaintenanceFlag,
};
