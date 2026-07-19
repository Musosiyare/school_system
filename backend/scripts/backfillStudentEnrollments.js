// One-time backfill: reconstructs StudentEnrollment rows for data that
// existed before enrollment-tracking was added.
//
// For every student, this creates an enrollment row for:
//   1. Every (studentId, classId) pair that appears in Marks — since a mark
//      can only have been recorded while the student was actually in that
//      class, this reconstructs real history with no guessing involved.
//   2. The student's current classId, in case they have no marks yet.
//
// Run once after deploying the StudentEnrollment model:
//   cd backend && node scripts/backfillStudentEnrollments.js
//
// Safe to re-run — it only ever fills in missing (studentId, academicYearId)
// rows and never overwrites one that already exists.
require("dotenv").config();
const sequelize = require("../src/config/database");
const { Student, StudentEnrollment, Class, Mark } = require("../src/models");

async function run() {
  await sequelize.authenticate();

  const students = await Student.findAll();
  let created = 0;
  let skipped = 0;

  for (const student of students) {
    // Distinct classIds this student has marks recorded against.
    const markRows = await Mark.findAll({
      where: { studentId: student.id },
      attributes: ["classId"],
      group: ["classId"],
    });
    const classIds = new Set(markRows.map((m) => m.classId));
    classIds.add(student.classId); // always cover their current class too

    for (const classId of classIds) {
      const klass = await Class.findByPk(classId);
      if (!klass) continue;

      const existing = await StudentEnrollment.findOne({
        where: { studentId: student.id, academicYearId: klass.academicYearId },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await StudentEnrollment.create({
        studentId: student.id,
        classId,
        academicYearId: klass.academicYearId,
        schoolId: student.schoolId,
      });
      created += 1;
    }
  }

  console.log(`Backfill complete. Created ${created} enrollment rows, skipped ${skipped} that already existed.`);
  await sequelize.close();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
