const {
  sequelize,
  Student,
  StudentEnrollment,
  Class,
  AcademicYear,
} = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateStudentId = require("../utils/generateStudentId");

const YEAR_CHANGING_STATUSES = ["promoted", "repeated", "transferred"];
const EXIT_STATUSES = ["graduated", "dropped"];
const ALL_STATUSES = [...YEAR_CHANGING_STATUSES, ...EXIT_STATUSES];

// GET /api/promotions/roster?classId=&destAcademicYearId=
// Shows the manager exactly who is sitting in a source class right now, and
// — for each student — whether they've already been pulled/copied into the
// destination year (so it can't accidentally be done twice). Since pulling
// creates a brand-new student row and never touches the original, we can't
// just check the original's own enrollment history for the dest year —
// instead we look for any existing copy (Student.pulledFromStudentId
// pointing back at this student) that's enrolled in the destination year.
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

    const studentIds = students.map((s) => s.id);
    const copies = studentIds.length
      ? await Student.findAll({
          where: { schoolId: req.schoolId, pulledFromStudentId: studentIds },
          attributes: ["id", "pulledFromStudentId"],
        })
      : [];

    if (copies.length) {
      const copyIds = copies.map((c) => c.id);
      const existing = await StudentEnrollment.findAll({
        where: { academicYearId: destYear.id, studentId: copyIds },
        attributes: ["studentId"],
      });
      const enrolledCopyIds = new Set(existing.map((e) => e.studentId));
      copies.forEach((c) => {
        if (enrolledCopyIds.has(c.id)) alreadyProcessedIds.add(c.pulledFromStudentId);
      });
    }
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
// must belong to a DIFFERENT academic year from sourceClassId — this
// endpoint is specifically for pulling students across years. Each
// selected student is COPIED into a brand-new Student row in destClass,
// with its own fresh admission number and a new StudentEnrollment for the
// destination year. The original student is never modified in any way —
// they stay exactly where they were, in their original class, with all
// their marks and history untouched. That's the whole point of "pulling":
// it's a copy, not a cut.
//
// For "graduated" / "dropped": no destClassId is needed. The student's
// last enrollment row stands as their final academic record, and their
// Student.status is flipped to "inactive" so they drop out of active
// rosters without deleting anything.
//
// Processes students one at a time (each in its own transaction) so one
// bad row (e.g. already pulled into that year) doesn't block the rest of
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
  let destAcademicYear = null;
  if (YEAR_CHANGING_STATUSES.includes(status)) {
    if (!destClassId) throw ApiError.badRequest("destClassId is required for this status");

    destClass = await Class.findOne({ where: { id: destClassId, schoolId: req.schoolId } });
    if (!destClass) throw ApiError.badRequest("Invalid destClassId for this school");

    if (destClass.academicYearId === sourceClass.academicYearId) {
      throw ApiError.badRequest(
        "destClassId must be in a different academic year from sourceClassId — this endpoint is for year rollover, not same-year transfers"
      );
    }

    destAcademicYear = await AcademicYear.findByPk(destClass.academicYearId);
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

      if (EXIT_STATUSES.includes(status)) {
        // Graduating or leaving: no new class, no new row — their existing
        // history simply stops here. Only the student's status changes, so
        // they disappear from active rosters.
        await sequelize.transaction(async (t) => {
          student.status = "inactive";
          await student.save({ transaction: t });
        });
        results.push({ studentId, success: true });
        continue;
      }

      // Reject early if this student was already pulled into the
      // destination year, so we don't create a second duplicate copy.
      const existingCopies = await Student.findAll({
        where: { schoolId: req.schoolId, pulledFromStudentId: student.id },
        attributes: ["id"],
      });
      if (existingCopies.length) {
        const existingEnrollment = await StudentEnrollment.findOne({
          where: {
            studentId: existingCopies.map((c) => c.id),
            academicYearId: destClass.academicYearId,
          },
        });
        if (existingEnrollment) {
          results.push({
            studentId,
            success: false,
            message: "Already pulled into the destination academic year",
          });
          continue;
        }
      }

      await sequelize.transaction(async (t) => {
        const copy = await Student.create(
          {
            schoolId: req.schoolId,
            classId: destClass.id,
            firstName: student.firstName,
            lastName: student.lastName,
            dob: student.dob,
            sex: student.sex,
            guardianName: student.guardianName,
            guardianPhone: student.guardianPhone,
            status: "active",
            pulledFromStudentId: student.id,
          },
          { transaction: t }
        );

        copy.admissionNumber = generateStudentId({
          schoolId: req.schoolId,
          className: destClass.name,
          academicYearName: destAcademicYear ? destAcademicYear.name : null,
          insertionId: copy.id,
        });
        await copy.save({ transaction: t });

        await StudentEnrollment.create(
          {
            studentId: copy.id,
            classId: destClass.id,
            academicYearId: destClass.academicYearId,
            schoolId: req.schoolId,
          },
          { transaction: t }
        );
      });

      results.push({ studentId, success: true });
    } catch (err) {
      const message =
        err.name === "SequelizeUniqueConstraintError"
          ? "Already pulled into the destination academic year"
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
