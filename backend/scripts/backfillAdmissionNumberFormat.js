// One-time backfill: regenerates every student's admissionNumber using the
// current (fixed 13-character) format in src/utils/generateStudentId.js.
//
// Admission numbers generated before that fix varied in length (11-14
// characters) because the trailing insertionId segment grew unpadded as
// student ids climbed. This script re-derives each student's admission
// number from their existing class/school/enrollment-year context, so
// every record ends up exactly 13 characters — it does NOT change which
// class or year a student belongs to, only the printed admission number
// string.
//
// Safe to re-run: it's fully deterministic (same inputs -> same output), so
// running it twice just regenerates the same values the second time.
//
// IMPORTANT: admission numbers already printed on report cards, ID cards,
// or shared with guardians will change. Run this deliberately, not as part
// of routine deploys — read the summary it prints before telling anyone
// their numbers changed.
//
// Usage:
//   cd backend && node scripts/backfillAdmissionNumberFormat.js
//   cd backend && node scripts/backfillAdmissionNumberFormat.js --dry-run
require("dotenv").config();
const sequelize = require("../src/config/database");
const { Student, Class, AcademicYear } = require("../src/models");
const generateStudentId = require("../src/utils/generateStudentId");

const dryRun = process.argv.includes("--dry-run");

async function run() {
  await sequelize.authenticate();

  const students = await Student.findAll();
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const student of students) {
    const klass = await Class.findByPk(student.classId);
    if (!klass) {
      skipped += 1;
      console.warn(`Skipping student ${student.id}: class ${student.classId} no longer exists.`);
      continue;
    }
    const academicYear = await AcademicYear.findByPk(klass.academicYearId);

    const newAdmissionNumber = generateStudentId({
      schoolId: student.schoolId,
      className: klass.name,
      academicYearName: academicYear ? academicYear.name : null,
      insertionId: student.id,
    });

    if (newAdmissionNumber === student.admissionNumber) {
      unchanged += 1;
      continue;
    }

    console.log(
      `Student ${student.id} (${student.firstName} ${student.lastName}): ` +
        `${student.admissionNumber || "(none)"} -> ${newAdmissionNumber}`
    );

    if (!dryRun) {
      student.admissionNumber = newAdmissionNumber;
      await student.save();
    }
    updated += 1;
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] " : ""}Backfill complete. ` +
      `${updated} admission number(s) ${dryRun ? "would be " : ""}updated, ` +
      `${unchanged} already matched the fixed format, ${skipped} skipped (missing class).`
  );
  await sequelize.close();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
