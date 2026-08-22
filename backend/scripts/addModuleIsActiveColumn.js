// One-off migration: adds the `is_active` column to `modules`.
//
// Needed because the Module model now has an `isActive` field (lets a
// manager deactivate a module school-wide so teachers can no longer record
// marks for it and it drops off report cards), but existing databases were
// created before that field existed.
//
// This does ONE targeted `ALTER TABLE ... ADD COLUMN`, not a full
// `sequelize.sync({ alter: true })` — deliberately, since alter-sync on the
// whole schema is what caused the "Too many keys specified; max 64 keys
// allowed" duplicate-index issue before. Safe to run more than once: it
// checks whether the column already exists first and does nothing if so.
//
// Usage (from the backend/ folder):
//   node scripts/addModuleIsActiveColumn.js

require("dotenv").config();
const sequelize = require("../src/config/database");

async function run() {
  await sequelize.authenticate();

  const [existing] = await sequelize.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'is_active'`
  );

  if (existing.length > 0) {
    console.log("`is_active` column already exists on `modules` — nothing to do.");
  } else {
    await sequelize.query(
      "ALTER TABLE `modules` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1"
    );
    console.log("Added `is_active` column to `modules` (defaulted to active for every existing module).");
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
