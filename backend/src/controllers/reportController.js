const { Student, Class, School, User, Term } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { buildStudentReport, rankClass, buildStudentProgress } = require("../services/reportService");
const { generateReportCardPdf, generateClassReportPdf } = require("../services/pdfService");

// The school manager's name shows up on every report card, next to the
// class teacher's, as the person who signs off on it.
async function getSchoolManagerName(schoolId) {
  const manager = await User.findOne({
    where: { schoolId, role: "manager" },
    attributes: ["name"],
  });
  return manager ? manager.name : null;
}

// Attaches this student's classRank by running the same ranking the class
// report uses, so a single student's report card shows their rank too.
async function attachRank(report, classId, termId) {
  if (!report) return report;
  const classRankings = await rankClass(classId, termId);
  const match = classRankings.find((r) => r && r.student.id === report.student.id);
  report.classRank = match ? match.classRank : undefined;
  report.classRankTotal = match ? match.classRankTotal : undefined;
  return report;
}

// Blocks viewing/downloading a report once the manager has locked the term
// — the manager (head teacher) themself is always exempt, since they're
// the one who can unlock it. Reuses the same isLocked flag that already
// blocks marks editing, so there's only one on/off switch per term.
async function assertReportsEnabled(termId, req) {
  const term = await Term.findByPk(termId);
  if (!term) throw ApiError.notFound("Term not found");
  if (term.isLocked && req.user.role !== "manager") {
    throw ApiError.reportsDisabled();
  }
}

async function assertStudentInSchool(studentId, schoolId) {
  const student = await Student.findOne({ where: { id: studentId, schoolId }, include: [Class] });
  if (!student) throw ApiError.notFound("Student not found");
  return student;
}

// Class Teacher may only access their own class; Manager may access any class in their school
async function assertClassAccess(classId, req) {
  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  if (req.user.role === "teacher" && klass.classTeacherId !== req.user.id) {
    throw ApiError.forbidden("You can only view reports for your own class");
  }
  if (req.user.role === "teacher" && klass.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
  }
  return klass;
}

// GET /api/reports/student/:studentId/term/:termId
const getStudentReport = asyncHandler(async (req, res) => {
  const student = await assertStudentInSchool(req.params.studentId, req.schoolId);
  await assertClassAccess(student.classId, req);
  await assertReportsEnabled(req.params.termId, req);

  const school = await School.findByPk(req.schoolId, { attributes: ["name", "address", "email", "phone"] });
  const report = await buildStudentReport(student.id, req.params.termId);
  if (!report) throw ApiError.notFound("Report data not found");
  await attachRank(report, student.classId, req.params.termId);
  report.schoolManagerName = await getSchoolManagerName(req.schoolId);
  report.schoolName = school?.name || null;
  report.schoolAddress = school?.address || null;
  report.schoolEmail = school?.email || null;
  report.schoolPhone = school?.phone || null;
  res.json({ report });
});

// GET /api/reports/student/:studentId/term/:termId/pdf
const getStudentReportPdf = asyncHandler(async (req, res) => {
  const student = await assertStudentInSchool(req.params.studentId, req.schoolId);
  await assertClassAccess(student.classId, req);
  await assertReportsEnabled(req.params.termId, req);

  const school = await School.findByPk(req.schoolId);
  const report = await buildStudentReport(student.id, req.params.termId);
  if (!report) throw ApiError.notFound("Report data not found");
  await attachRank(report, student.classId, req.params.termId);
  const schoolManagerName = await getSchoolManagerName(req.schoolId);

  const pdfBuffer = await generateReportCardPdf(
    report,
    school.name,
    schoolManagerName,
    school.address,
    school.email,
    school.phone
  );
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="report-${student.id}-term${req.params.termId}.pdf"`,
  });
  res.send(pdfBuffer);
});

// GET /api/reports/class/:classId/term/:termId
const getClassReport = asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req.params.classId, req);
  await assertReportsEnabled(req.params.termId, req);
  const reports = await rankClass(klass.id, req.params.termId);
  const school = await School.findByPk(req.schoolId, { attributes: ["name", "address", "email", "phone"] });
  const schoolManagerName = await getSchoolManagerName(req.schoolId);
  res.json({
    className: klass.name,
    schoolManagerName,
    schoolName: school?.name || null,
    schoolAddress: school?.address || null,
    schoolEmail: school?.email || null,
    schoolPhone: school?.phone || null,
    reports,
  });
});

// GET /api/reports/class/:classId/term/:termId/pdf
const getClassReportPdf = asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req.params.classId, req);
  await assertReportsEnabled(req.params.termId, req);
  const school = await School.findByPk(req.schoolId);
  const reports = await rankClass(klass.id, req.params.termId);
  const schoolManagerName = await getSchoolManagerName(req.schoolId);

  const pdfBuffer = await generateClassReportPdf(
    reports,
    klass.name,
    school.name,
    schoolManagerName,
    school.address,
    school.email,
    school.phone
  );
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="class-report-${klass.id}-term${req.params.termId}.pdf"`,
  });
  res.send(pdfBuffer);
});

// GET /api/reports/student/:studentId/progress
const getStudentProgress = asyncHandler(async (req, res) => {
  const student = await assertStudentInSchool(req.params.studentId, req.schoolId);
  await assertClassAccess(student.classId, req);

  const progress = await buildStudentProgress(student.id);
  if (!progress) throw ApiError.notFound("Progress data not found");
  res.json(progress);
});

module.exports = {
  getStudentReport,
  getStudentReportPdf,
  getClassReport,
  getClassReportPdf,
  getStudentProgress,
};
