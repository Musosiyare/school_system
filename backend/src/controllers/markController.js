const { Mark, TeacherModuleAssignment, Term, Module, Student, Class, School, User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { generateMarksEvidencePdf } = require("../services/pdfService");

async function assertTeacherIsAssigned(userId, role, moduleId, classId) {
  if (role === "manager") return; // manager can view/manage all
  const assignment = await TeacherModuleAssignment.findOne({
    where: { teacherId: userId, moduleId, classId },
  });
  if (!assignment) {
    throw ApiError.forbidden("You are not assigned to teach this module for this class");
  }
}

// POST /api/marks — bulk create/update marks for a class+module+term (FR-4.1, FR-4.2, FR-4.5)
const submitMarks = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId, entries } = req.body;

  if (!classId || !moduleId || !termId || !Array.isArray(entries) || entries.length === 0) {
    throw ApiError.badRequest("classId, moduleId, termId and a non-empty entries array are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, moduleId, classId);

  const term = await Term.findByPk(termId);
  if (!term) throw ApiError.badRequest("Invalid termId");
  if (term.isLocked) throw ApiError.termLocked();

  const module = await Module.findOne({ where: { id: moduleId, schoolId: req.schoolId } });
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");

  // Validate every entry before writing anything (FR-4.3)
  entries.forEach((e, idx) => {
    if (typeof e.studentId !== "number") {
      throw ApiError.badRequest(`entries[${idx}].studentId is required`, `entries[${idx}].studentId`);
    }
    if (typeof e.score !== "number" || e.score < 0 || e.score > module.maxScore) {
      throw ApiError.badRequest(
        `Score must be between 0 and ${module.maxScore} for this module`,
        `entries[${idx}].score`
      );
    }
  });

  const results = [];
  for (const entry of entries) {
    const student = await Student.findOne({ where: { id: entry.studentId, classId } });
    if (!student) {
      throw ApiError.badRequest(`Student ${entry.studentId} is not in this class`);
    }

    const [mark] = await Mark.findOrCreate({
      where: { studentId: entry.studentId, moduleId, termId },
      defaults: { classId, score: entry.score, recordedBy: req.user.id },
    });

    if (mark.score !== entry.score) {
      mark.score = entry.score;
      mark.recordedBy = req.user.id;
      await mark.save();
    }
    results.push(mark);
  }

  res.status(201).json({ marks: results });
});

// GET /api/marks?classId=&moduleId=&termId=
const getMarks = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId query params are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));

  const marks = await Mark.findAll({
    where: { classId, moduleId, termId },
    include: [Student],
  });

  res.json({ marks });
});

// GET /api/marks/evidence/pdf?classId=&moduleId=&termId= — a teacher's proof
// of what they recorded for a module/class/term. Lists every student in the
// class (not just those with a score), so gaps are visible as evidence too.
const getMarksEvidencePdf = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId query params are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));

  const [klass, module, term, school] = await Promise.all([
    Class.findOne({ where: { id: classId, schoolId: req.schoolId } }),
    Module.findOne({ where: { id: moduleId, schoolId: req.schoolId } }),
    Term.findByPk(termId),
    School.findByPk(req.schoolId),
  ]);
  if (!klass) throw ApiError.badRequest("Invalid classId for this school");
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");
  if (!term) throw ApiError.badRequest("Invalid termId");

  // Whoever's assignment this is — for a teacher that's themselves; a
  // manager pulling this for oversight sees the actual assigned teacher.
  let teacherName;
  if (req.user.role === "manager") {
    const assignment = await TeacherModuleAssignment.findOne({
      where: { moduleId, classId },
      include: [{ model: User, as: "teacher", attributes: ["name"] }],
    });
    teacherName = assignment?.teacher?.name || "Unassigned";
  } else {
    const requester = await User.findByPk(req.user.id, { attributes: ["name"] });
    teacherName = requester?.name || "Unknown";
  }

  const students = await Student.findAll({ where: { classId }, order: [["firstName", "ASC"]] });
  const marks = await Mark.findAll({ where: { classId, moduleId, termId } });
  const scoreByStudent = Object.fromEntries(marks.map((m) => [m.studentId, m.score]));

  const rows = students.map((s) => ({
    studentName: `${s.firstName} ${s.lastName}`,
    admissionNumber: s.admissionNumber,
    score: scoreByStudent[s.id] ?? null,
  }));

  const pdfBuffer = await generateMarksEvidencePdf(
    {
      moduleTitle: module.moduleTitle,
      moduleCode: module.moduleCode,
      className: klass.name,
      termName: term.name,
      teacherName,
      maxScore: module.maxScore,
      passingLine: module.passingLine,
      rows,
      generatedAt: new Date().toLocaleDateString(),
    },
    school.name
  );

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="marks-evidence-class${classId}-module${moduleId}-term${termId}.pdf"`,
  });
  res.send(pdfBuffer);
});

module.exports = { submitMarks, getMarks, getMarksEvidencePdf };
