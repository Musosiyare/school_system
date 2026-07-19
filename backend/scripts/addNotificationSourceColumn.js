// One-off migration: adds the `source` column to `notifications`.
//
// Needed because the Notification model now has a `source` field (used to
// tag and later bulk-clear maintenance-schedule notifications), but existing
// databases were created before that field existed.
//
// This does ONE targeted `ALTER TABLE ... ADD COLUMN`, not a full
// `sequelize.sync({ alter: true })` — deliberately, since alter-sync on the
// whole schema is what caused the "Too many keys specified" duplicate-index
// issue before. Safe to run more than once: it checks whether the column
// already exists first and does nothing if so.
//
// Usage (from the backend/ folder):
//   node scripts/addNotificationSourceColumn.js

require("dotenv").config();
const sequelize = require("../src/config/database");

async function run() {
  await sequelize.authenticate();

  const [existing] = await sequelize.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'source'`
  );

  if (existing.length > 0) {
    console.log("`source` column already exists on `notifications` — nothing to do.");
  } else {
    await sequelize.query("ALTER TABLE `notifications` ADD COLUMN `source` VARCHAR(255) NULL");
    console.log("Added `source` column to `notifications`.");
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
