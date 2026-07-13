const { Class, AcademicYear } = require("../models");
const ApiError = require("./ApiError");

// A single place that defines what "archived year is frozen for teachers"
// means at the data-access level. Managers are always exempt — they can
// still open an archived year read-only to retrieve old reports.
async function assertClassYearAccessible(classId, role) {
  if (role === "manager") return;
  const klass = await Class.findByPk(classId, { include: [AcademicYear] });
  if (klass?.AcademicYear?.isArchived) {
    throw ApiError.forbidden("This academic year has been archived and is no longer available to teachers");
  }
}

module.exports = { assertClassYearAccessible };
