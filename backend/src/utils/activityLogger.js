const { ActivityLog } = require("../models");

// Fire-and-forget: called from inside controllers right after the real
// write succeeds. Deliberately never throws — if writing the log entry
// fails for some reason, that's a shame, but it must never take down the
// actual request that already succeeded. Errors are swallowed after being
// logged to the server console for visibility.
async function logActivity({ userId, schoolId = null, action, description, entityType = null, entityId = null }) {
  try {
    await ActivityLog.create({ userId, schoolId, action, description, entityType, entityId });
  } catch (err) {
    console.error("Failed to write activity log:", err.message);
  }
}

module.exports = { logActivity };
