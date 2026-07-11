const { Term, AcademicYear } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// PATCH /api/terms/:id/lock  { isLocked: true|false }
// Manager-only. Locking a term also blocks teachers (but not the manager)
// from viewing or downloading report cards for it — see assertReportsEnabled
// in reportController.js — in addition to blocking marks editing.
const setTermLock = asyncHandler(async (req, res) => {
  const { isLocked } = req.body;
  if (typeof isLocked !== "boolean") {
    throw ApiError.badRequest("isLocked must be a boolean", "isLocked");
  }

  const term = await Term.findByPk(req.params.id, { include: [AcademicYear] });
  if (!term || term.AcademicYear.schoolId !== req.schoolId) {
    throw ApiError.notFound("Term not found");
  }

  term.isLocked = isLocked;
  await term.save();
  res.json({ term });
});

const listTermsForYear = asyncHandler(async (req, res) => {
  const year = await AcademicYear.findOne({
    where: { id: req.params.yearId, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.notFound("Academic year not found");

  const terms = await Term.findAll({ where: { academicYearId: year.id }, order: [["id", "ASC"]] });
  res.json({ terms });
});

module.exports = { setTermLock, listTermsForYear };
