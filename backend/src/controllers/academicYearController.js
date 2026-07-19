const {
  sequelize,
  AcademicYear,
  Term,
  Class,
  ClassModule,
  Student,
  StudentEnrollment,
  Mark,
  ReportRemark,
  TeacherModuleAssignment,
  Notification,
} = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const createAcademicYear = asyncHandler(async (req, res) => {
  const { name, startDate, endDate } = req.body;
  if (!name) throw ApiError.badRequest("name is required", "name");

  // The school's current year (if any) right before this new one is
  // created — its class structure gets carried forward below, the same way
  // teachers and modules already aren't tied to a year and just carry over
  // for free. Read this BEFORE creating the new year, while "current" still
  // points at the outgoing year.
  const previousYear = await AcademicYear.findOne({
    where: { schoolId: req.schoolId, isCurrent: true },
  });

  // The very first academic year a school creates becomes current
  // automatically, so there's always something for classes/marks/reports to
  // use without an extra manual step. After that, the manager switches the
  // current year explicitly via setCurrentAcademicYear.
  const existingCount = await AcademicYear.count({ where: { schoolId: req.schoolId } });

  const year = await AcademicYear.create({
    schoolId: req.schoolId,
    name,
    startDate,
    endDate,
    isCurrent: existingCount === 0,
  });

  // Auto-create Term 1, Term 2, Term 3 for this academic year
  await Term.bulkCreate(
    ["Term 1", "Term 2", "Term 3"].map((termName) => ({
      academicYearId: year.id,
      name: termName,
    }))
  );

  // Carry forward the previous year's classes — same name, category, class
  // teacher, and modules taught — into the new year. A school's class
  // structure (S1A, S1B, S2A...) is normally stable year over year, so this
  // saves rebuilding it by hand every time; the manager can still rename,
  // reassign, or delete any of these once the new year is made active.
  // Rosters and marks are never copied — every class starts empty for the
  // new year, since who's actually enrolled is a fresh decision each year.
  let carriedClasses = 0;
  if (previousYear) {
    const prevClasses = await Class.findAll({
      where: { schoolId: req.schoolId, academicYearId: previousYear.id },
      include: [ClassModule],
    });

    for (const prevClass of prevClasses) {
      const newClass = await Class.create({
        schoolId: req.schoolId,
        academicYearId: year.id,
        name: prevClass.name,
        category: prevClass.category,
        classTeacherId: prevClass.classTeacherId,
      });
      if (prevClass.ClassModules?.length) {
        await ClassModule.bulkCreate(
          prevClass.ClassModules.map((cm) => ({ classId: newClass.id, moduleId: cm.moduleId }))
        );
      }
      carriedClasses += 1;
    }
  }

  res.status(201).json({ academicYear: year, carriedClasses });
});

// GET /api/academic-years
// By default, returns only the current academic year (with its terms) — this
// is what class creation, marks entry, and reports should use, for both
// managers and teachers, so the whole app works off a single active year.
// Pass ?all=true (manager only) to fetch the full history for the Academic
// Years management page, where the manager reviews/switches the current year.
const listAcademicYears = asyncHandler(async (req, res) => {
  const wantsAll = req.query.all === "true";

  if (wantsAll && req.user.role !== "manager") {
    throw ApiError.forbidden("Only a school manager can view the full academic year history");
  }

  const where = { schoolId: req.schoolId };
  if (!wantsAll) {
    where.isCurrent = true;
  }

  const years = await AcademicYear.findAll({
    where,
    include: [Term],
    order: [["id", "DESC"]],
  });
  res.json({ academicYears: years });
});

// PATCH /api/academic-years/:id/set-current
const setCurrentAcademicYear = asyncHandler(async (req, res) => {
  const year = await AcademicYear.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.notFound("Academic year not found");

  if (!year.isCurrent) {
    // Unset any other current year for this school before flipping this one
    // on, so exactly one academic year is ever current at a time.
    await AcademicYear.update(
      { isCurrent: false },
      { where: { schoolId: req.schoolId, isCurrent: true } }
    );
    year.isCurrent = true;
    await year.save();
  }

  res.json({ academicYear: year });
});

// PATCH /api/academic-years/:id
// Renames an academic year. Only the name can be changed here — switching
// which year is "current" stays a separate, more deliberate action
// (setCurrentAcademicYear).
const updateAcademicYear = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw ApiError.badRequest("name is required", "name");

  const year = await AcademicYear.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.notFound("Academic year not found");

  year.name = name.trim();
  await year.save();

  res.json({ academicYear: year });
});

// DELETE /api/academic-years/:id
// Only allowed for an EMPTY year — no students enrolled and no marks
// recorded in any of its classes — so this can never destroy an academic
// record. Meant for cleaning up a year created by mistake (wrong name,
// duplicate, or before it's actually been used), not for getting rid of a
// year that's already been in use. The current year can never be deleted,
// since the school always needs exactly one to write into.
const deleteAcademicYear = asyncHandler(async (req, res) => {
  const year = await AcademicYear.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.notFound("Academic year not found");

  if (year.isCurrent) {
    throw ApiError.conflict(
      "This is the current academic year and can't be deleted. Set another year as current first.",
      "CANNOT_DELETE_CURRENT_YEAR"
    );
  }

  const classes = await Class.findAll({
    where: { schoolId: req.schoolId, academicYearId: year.id },
    attributes: ["id"],
  });
  const classIds = classes.map((c) => c.id);

  const [studentCount, markCount] = await Promise.all([
    classIds.length ? Student.count({ where: { classId: classIds } }) : 0,
    classIds.length ? Mark.count({ where: { classId: classIds } }) : 0,
  ]);

  if (studentCount > 0) {
    throw ApiError.conflict(
      "This academic year still has students enrolled and can't be deleted. Remove or promote them out first.",
      "YEAR_NOT_EMPTY"
    );
  }
  if (markCount > 0) {
    throw ApiError.conflict(
      "This academic year already has marks recorded and can't be deleted, to protect that academic record.",
      "YEAR_NOT_EMPTY"
    );
  }

  await sequelize.transaction(async (t) => {
    const terms = await Term.findAll({ where: { academicYearId: year.id }, transaction: t });
    const termIds = terms.map((tm) => tm.id);

    if (classIds.length) {
      await ClassModule.destroy({ where: { classId: classIds }, transaction: t });
      await TeacherModuleAssignment.destroy({ where: { classId: classIds }, transaction: t });
      await Notification.destroy({ where: { classId: classIds }, transaction: t });
      // Defensive — should already be zero given the studentCount check
      // above, but clears any orphaned enrollment rows for a class in this
      // year before the class itself is deleted.
      await StudentEnrollment.destroy({ where: { classId: classIds }, transaction: t });
    }
    if (termIds.length) {
      await ReportRemark.destroy({ where: { termId: termIds }, transaction: t });
      await Notification.destroy({ where: { termId: termIds }, transaction: t });
    }
    await StudentEnrollment.destroy({ where: { academicYearId: year.id }, transaction: t });
    await Class.destroy({ where: { id: classIds }, transaction: t });
    await Term.destroy({ where: { academicYearId: year.id }, transaction: t });
    await year.destroy({ transaction: t });
  });

  res.json({ message: "Academic year deleted" });
});

module.exports = {
  createAcademicYear,
  listAcademicYears,
  setCurrentAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
};
