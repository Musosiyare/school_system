// One-off migration: adds "discipline" as a valid value of the users.role
// ENUM, and converts existing discipline-only accounts over to it.
//
// Before this migration, every discipline-only account (isDisciplineOnly =
// true — created via the "New disciplinary staff" flow, for someone who
// never teaches) was stored with role = 'teacher', because 'teacher' was
// the closest option available. That meant they logged into the main
// system with real teacher permissions (marks entry, module status, the
// Teacher Dashboard, etc.) even though they never teach — and they were
// counted as teachers in platform/school statistics unless a query
// specifically excluded them. role = 'discipline' fixes that: it's a
// distinct value with no teacher-level access, reserved for accounts that
// exist purely for SBMS. Real teachers who also hold a discipline role are
// NOT affected — they keep role = 'teacher', since they still need full
// teacher access here; disciplineRole is what grants their SBMS access on
// top of that.
//
// This does two things, both safe to run more than once:
//   1. ALTER the `role` ENUM column to include 'discipline' (checks the
//      current column definition first and skips if already present).
//   2. UPDATE existing rows: role='teacher' AND is_discipline_only=1
//      becomes role='discipline'.
//
// Usage (from the backend/ folder):
//   node scripts/addDisciplineRoleValue.js

require("dotenv").config();
const sequelize = require("../src/config/database");

async function run() {
  await sequelize.authenticate();

  const [[columnInfo]] = await sequelize.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
  );

  if (!columnInfo) {
    throw new Error("Could not find `users`.`role` column — is the database up to date otherwise?");
  }

  if (columnInfo.COLUMN_TYPE.includes("'discipline'")) {
    console.log("`role` ENUM already includes 'discipline' — skipping ALTER.");
  } else {
    await sequelize.query(
      "ALTER TABLE `users` MODIFY COLUMN `role` ENUM('superuser','manager','teacher','discipline') NOT NULL"
    );
    console.log("Added 'discipline' to the `role` ENUM.");
  }

  const [result] = await sequelize.query(
    "UPDATE `users` SET `role` = 'discipline' WHERE `role` = 'teacher' AND `is_discipline_only` = 1"
  );
  console.log(`Converted ${result.affectedRows ?? 0} discipline-only account(s) from role='teacher' to role='discipline'.`);

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
