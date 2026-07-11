const { AcademicYear, Term } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const createAcademicYear = asyncHandler(async (req, res) => {
  const { name, startDate, endDate } = req.body;
  if (!name) throw ApiError.badRequest("name is required", "name");

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

  res.status(201).json({ academicYear: year });
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

module.exports = { createAcademicYear, listAcademicYears, setCurrentAcademicYear };
