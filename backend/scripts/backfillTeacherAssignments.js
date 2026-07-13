// One-time fix for a "Start New Year" that ran BEFORE the fix that carries
// teacher module assignments over. If you started a new year already and
// teachers are seeing empty "Record Marks" / "Marks Status" pages, this
// script finds each current-year class's most recent archived-year
// counterpart (matched by class name) and copies its teacher assignments
// across, IF the current class doesn't already have any assignments of its
// own — so it's safe to run even on classes you've already fixed by hand.
//
// Usage (from the backend/ folder):
//   node scripts/backfillTeacherAssignments.js

require("dotenv").config();
const sequelize = require("../src/config/database");
const { AcademicYear, Class, TeacherModuleAssignment } = require("../src/models");

async function run() {
  await sequelize.authenticate();

  const currentYear = await AcademicYear.findOne({ where: { isCurrent: true } });
  if (!currentYear) {
    console.log("No current academic year found — nothing to do.");
    return process.exit(0);
  }

  const currentClasses = await Class.findAll({ where: { academicYearId: currentYear.id } });
  let fixedClasses = 0;
  let copiedAssignments = 0;
  let skipped = 0;

  for (const klass of currentClasses) {
    const existingCount = await TeacherModuleAssignment.count({ where: { classId: klass.id } });
    if (existingCount > 0) {
      skipped++;
      continue; // already has assignments — don't touch it
    }

    // Find the most recently archived class with the same name and school,
    // in a different (earlier) academic year — that's almost certainly the
    // class this one was cloned from.
    const sourceClass = await Class.findOne({
      where: { name: klass.name, schoolId: klass.schoolId },
      include: [{ model: AcademicYear, where: { isArchived: true } }],
      order: [["id", "DESC"]],
    });
    if (!sourceClass) continue;

    const oldAssignments = await TeacherModuleAssignment.findAll({ where: { classId: sourceClass.id } });
    if (oldAssignments.length === 0) continue;

    for (const a of oldAssignments) {
      await TeacherModuleAssignment.findOrCreate({
        where: {
          teacherId: a.teacherId,
          moduleId: a.moduleId,
          classId: klass.id,
          academicYearId: currentYear.id,
        },
      });
      copiedAssignments++;
    }
    fixedClasses++;
  }

  console.log(
    `Checked ${currentClasses.length} current-year class(es). Fixed ${fixedClasses} class(es), copied ${copiedAssignments} assignment(s), skipped ${skipped} (already had assignments).`
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
