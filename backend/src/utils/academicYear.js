const { AcademicYear } = require("../models");
const ApiError = require("./ApiError");

// Every write path that touches year-scoped data (classes, students,
// marks, assignments, remarks) should go through this so a manager viewing
// an old academic year can never accidentally mutate it — the whole point
// of keeping years independent is that switching back to review 2026-2027
// never risks changing what's stored there.
async function getCurrentAcademicYear(schoolId) {
  return AcademicYear.findOne({ where: { schoolId, isCurrent: true } });
}

// Throws unless academicYearId is this school's current year. Pass the
// already-loaded current year via `currentYear` when the caller already has
// it, to avoid a repeat query.
async function assertCurrentYear(academicYearId, schoolId, currentYear = null) {
  const year = currentYear || (await getCurrentAcademicYear(schoolId));
  if (!year || Number(year.id) !== Number(academicYearId)) {
    throw ApiError.yearArchived();
  }
  return year;
}

module.exports = { getCurrentAcademicYear, assertCurrentYear };
