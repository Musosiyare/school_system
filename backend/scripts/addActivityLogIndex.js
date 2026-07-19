// One-off migration: adds a (user_id, created_at) index to `activity_logs`.
//
// Needed because your table was already created (by sequelize.sync()
// without alter) before this index was added to the model — sync() only
// creates missing tables, it never alters existing ones. Without this,
// the activity log query re-scans and re-sorts the whole table on every
// request as it grows.
//
// Note: this project's Sequelize config sets `underscored: true`, so the
// actual MySQL columns are snake_case (user_id, created_at) even though the
// JS-side model attributes are camelCase (userId, createdAt).
//
// Safe to run more than once: it checks whether the index already exists
// first and does nothing if so.
//
// Usage (from the backend/ folder):
//   node scripts/addActivityLogIndex.js

require("dotenv").config();
const sequelize = require("../src/config/database");

async function run() {
  await sequelize.authenticate();

  const [existing] = await sequelize.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_logs' AND INDEX_NAME = 'activity_logs_user_id_created_at'`
  );

  if (existing.length > 0) {
    console.log("Index already exists on `activity_logs` — nothing to do.");
  } else {
    await sequelize.query(
      "ALTER TABLE `activity_logs` ADD INDEX `activity_logs_user_id_created_at` (`user_id`, `created_at`)"
    );
    console.log("Added (user_id, created_at) index to `activity_logs`.");
  }

  await sequelize.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
