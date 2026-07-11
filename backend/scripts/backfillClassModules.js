// One-time fix for data created BEFORE the assignment→ClassModule auto-link
// fix. Run this once after deploying that fix so existing assignments (made
// via the Assignments page before now) also show up on class reports.
//
// Usage (from the backend/ folder):
//   node scripts/backfillClassModules.js
//
// Safe to run more than once — it only creates missing links, never
// duplicates or removes anything.

require("dotenv").config();
const sequelize = require("../src/config/database");
const { TeacherModuleAssignment, ClassModule } = require("../src/models");

async function run() {
  await sequelize.authenticate();

  const assignments = await TeacherModuleAssignment.findAll();
  let created = 0;

  for (const a of assignments) {
    const [, wasCreated] = await ClassModule.findOrCreate({
      where: { classId: a.classId, moduleId: a.moduleId },
    });
    if (wasCreated) created++;
  }

  console.log(`Checked ${assignments.length} assignment(s). Created ${created} missing class-module link(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
