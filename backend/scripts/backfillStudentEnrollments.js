// One-time fix for students created BEFORE the StudentEnrollment (year
// history) feature existed. Run this once after deploying that feature so
// every existing active student gets a starting enrollment row for
// whatever class/year they're currently sitting in — otherwise their year
// history would only start from the next promotion onward, leaving a gap
// for anything before that.
//
// Usage (from the backend/ folder):
//   node scripts/backfillStudentEnrollments.js
//
// Safe to run more than once — it only creates a row for students who
// don't already have one for their current class's academic year, never
// duplicates or removes anything.

require("dotenv").config();
const sequelize = require("../src/config/database");
const { Student, StudentEnrollment, Class } = require("../src/models");

async function run() {
  await sequelize.authenticate();

  const students = await Student.findAll({ where: { status: "active" } });
  let created = 0;
  let skipped = 0;

  for (const student of students) {
    const klass = await Class.findByPk(student.classId);
    if (!klass) {
      console.warn(`Skipping student ${student.id} (${student.firstName} ${student.lastName}): class ${student.classId} not found`);
      skipped++;
      continue;
    }

    const [, wasCreated] = await StudentEnrollment.findOrCreate({
      where: { studentId: student.id, academicYearId: klass.academicYearId },
      defaults: { classId: klass.id, status: "new" },
    });
    if (wasCreated) created++;
  }

  console.log(
    `Checked ${students.length} student(s). Created ${created} missing enrollment record(s), skipped ${skipped}.`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
