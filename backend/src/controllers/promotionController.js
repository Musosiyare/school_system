const {
  sequelize,
  Student,
  StudentEnrollment,
  Class,
  AcademicYear,
} = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const YEAR_CHANGING_STATUSES = ["promoted", "repeated", "transferred"];
const EXIT_STATUSES = ["graduated", "dropped"];
const ALL_STATUSES = [...YEAR_CHANGING_STATUSES, ...EXIT_STATUSES];

// GET /api/promotions/roster?classId=&destAcademicYearId=
// Shows the manager exactly who is sitting in a source class right now, and
// — for each student — whether they've already been processed for the
// destination year (so a promotion can't accidentally be run twice; the
// unique index on student_id+academic_year_id would reject it anyway, but
// this lets the UI grey them out up front instead of erroring later).
const getPromotionRoster = asyncHandler(async (req, res) => {
  const { classId, destAcademicYearId } = req.query;
  if (!classId) throw ApiError.badRequest("classId query param is required");

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");

  const students = await Student.findAll({
    where: { classId: klass.id, status: "active" },
    order: [["firstName", "ASC"]],
  });

  let alreadyProcessedIds = new Set();
  if (destAcademicYearId) {
    const destYear = await AcademicYear.findOne({
      where: { id: destAcademicYearId, schoolId: req.schoolId },
    });
    if (!destYear) throw ApiError.badRequest("Invalid destAcademicYearId for this school");

    const existing = await StudentEnrollment.findAll({
      where: { academicYearId: destYear.id, studentId: students.map((s) => s.id) },
      attributes: ["studentId"],
    });
    alreadyProcessedIds = new Set(existing.map((e) => e.studentId));
  }

  res.json({
    class: klass,
    students: students.map((s) => ({
      ...s.toJSON(),
      alreadyProcessedForDestYear: alreadyProcessedIds.has(s.id),
    })),
  });
});

// POST /api/promotions
// body: { sourceClassId, destClassId, status, studentIds: [...] }
//
// For "promoted" / "repeated" / "transferred": destClassId is required and
// must belong to a DIFFERENT academic year than sourceClassId — this
// endpoint is specifically for year rollover. (A same-year section change
// is a simple edit and already handled by PUT /students/:id.) For each
// student this creates one new StudentEnrollment row for the destination
// year and moves Student.classId forward. The source year's Class, Marks
// and StudentEnrollment rows are never modified.
//
// For "graduated" / "dropped": no destClassId is needed. The student's
// last enrollment row stands as their final academic record, and their
// Student.status is flipped to "inactive" so they drop out of active
// rosters without deleting anything.
//
// Processes students one at a time (each in its own transaction) so one
// bad row (e.g. already processed for that year) doesn't block the rest of
// the batch — the response reports per-student success/failure.
const promoteStudents = asyncHandler(async (req, res) => {
  const { sourceClassId, destClassId, status, studentIds } = req.body;

  if (!sourceClassId) throw ApiError.badRequest("sourceClassId is required");
  if (!status || !ALL_STATUSES.includes(status)) {
    throw ApiError.badRequest(`status must be one of: ${ALL_STATUSES.join(", ")}`);
  }
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw ApiError.badRequest("studentIds must be a non-empty array");
  }

  const sourceClass = await Class.findOne({
    where: { id: sourceClassId, schoolId: req.schoolId },
  });
  if (!sourceClass) throw ApiError.badRequest("Invalid sourceClassId for this school");

  let destClass = null;
  if (YEAR_CHANGING_STATUSES.includes(status)) {
    if (!destClassId) throw ApiError.badRequest("destClassId is required for this status");

    destClass = await Class.findOne({ where: { id: destClassId, schoolId: req.schoolId } });
    if (!destClass) throw ApiError.badRequest("Invalid destClassId for this school");

    if (destClass.academicYearId === sourceClass.academicYearId) {
      throw ApiError.badRequest(
        "destClassId must be in a different academic year from sourceClassId — this endpoint is for year rollover, not same-year transfers"
      );
    }
  }

  const results = [];

  for (const studentId of studentIds) {
    try {
      const student = await Student.findOne({
        where: { id: studentId, schoolId: req.schoolId, classId: sourceClass.id },
      });
      if (!student) {
        results.push({ studentId, success: false, message: "Student not found in source class" });
        continue;
      }

      const priorEnrollment = await StudentEnrollment.findOne({
        where: { studentId: student.id, classId: sourceClass.id, academicYearId: sourceClass.academicYearId },
        order: [["id", "DESC"]],
      });

      await sequelize.transaction(async (t) => {
        if (EXIT_STATUSES.includes(status)) {
          // Graduating or leaving: no new class, no new enrollment row —
          // their existing history simply stops here. Only the student's
          // status changes, so they disappear from active rosters.
          student.status = "inactive";
          await student.save({ transaction: t });
        } else {
          await StudentEnrollment.create(
            {
              studentId: student.id,
              classId: destClass.id,
              academicYearId: destClass.academicYearId,
              status,
              promotedFromEnrollmentId: priorEnrollment ? priorEnrollment.id : null,
            },
            { transaction: t }
          );
          student.classId = destClass.id;
          await student.save({ transaction: t });
        }
      });

      results.push({ studentId, success: true });
    } catch (err) {
      // Most likely cause: the unique (student_id, academic_year_id) index
      // rejected a duplicate — i.e. this student was already processed for
      // the destination year. Report it instead of failing the whole batch.
      const message =
        err.name === "SequelizeUniqueConstraintError"
          ? "Already processed for the destination academic year"
          : err.message || "Failed to process this student";
      results.push({ studentId, success: false, message });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  res.json({
    summary: `${succeeded} of ${studentIds.length} student(s) processed successfully`,
    results,
  });
});

module.exports = { getPromotionRoster, promoteStudents };
