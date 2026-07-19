const { ReportRemark, Student, Class, Term } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { assertCurrentYear } = require("../utils/academicYear");

// PUT /api/students/:studentId/remarks/:termId
const setRemark = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  const student = await Student.findOne({
    where: { id: req.params.studentId, schoolId: req.schoolId },
    include: [Class],
  });
  if (!student) throw ApiError.notFound("Student not found");

  if (req.user.role === "teacher" && student.Class.classTeacherId !== req.user.id) {
    throw ApiError.forbidden("You can only add remarks for your own class");
  }

  const term = await Term.findByPk(req.params.termId);
  if (!term) throw ApiError.notFound("Term not found");
  await assertCurrentYear(term.academicYearId, req.schoolId);

  const [remark] = await ReportRemark.findOrCreate({
    where: { studentId: student.id, termId: req.params.termId },
    defaults: { comment, createdBy: req.user.id },
  });
  remark.comment = comment;
  remark.createdBy = req.user.id;
  await remark.save();

  res.json({ remark });
});

module.exports = { setRemark };
