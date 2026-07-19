const {
  Student,
  StudentEnrollment,
  Class,
  Module,
  ClassModule,
  Mark,
  Term,
  AcademicYear,
  ReportRemark,
  User,
  TeacherModuleAssignment,
} = require("../models");

// Resolves the class a student actually belonged to during a given
// academic year — not just wherever they currently sit. Student.classId is
// only the LIVE pointer (updated whenever a manager moves someone to a new
// class), so once a student has been moved on, using it directly for an
// older term would silently pull in the wrong class's modules/roster/
// teachers. StudentEnrollment carries the real historical link; the live
// classId is only a fallback for records that predate that table.
async function resolveClassIdForYear(student, academicYearId) {
  const enrollment = await StudentEnrollment.findOne({
    where: { studentId: student.id, academicYearId },
  });
  return enrollment ? enrollment.classId : student.classId;
}

/**
 * Builds the full report data for a single student in a single term.
 * Implements SRS section 5: Business Rules & Calculation Logic.
 */
async function buildStudentReport(studentId, termId) {
  const student = await Student.findByPk(studentId);
  if (!student) return null;

  const term = await Term.findByPk(termId);
  if (!term) return null;

  const academicYear = await AcademicYear.findByPk(term.academicYearId);

  // The class this student was actually in during the term's academic
  // year — may differ from their current class if they've since moved on.
  const effectiveClassId = await resolveClassIdForYear(student, term.academicYearId);
  const klass = await Class.findByPk(effectiveClassId);

  // All modules taught in this student's class
  const classModules = await ClassModule.findAll({
    where: { classId: effectiveClassId },
    include: [Module],
  });

  const marks = await Mark.findAll({
    where: { studentId, termId },
  });
  const marksByModule = Object.fromEntries(marks.map((m) => [m.moduleId, m]));

  // Who actually teaches each module in this class — shown alongside the
  // module on the report card, since the module title alone doesn't say who
  // to go to about it.
  const moduleAssignments = await TeacherModuleAssignment.findAll({
    where: { classId: effectiveClassId },
    include: [{ model: User, as: "teacher", attributes: ["id", "name"] }],
  });
  const teacherNameByModule = Object.fromEntries(
    moduleAssignments.map((a) => [a.moduleId, a.teacher?.name || null])
  );

  const remark = await ReportRemark.findOne({ where: { studentId, termId } });

  const classTeacher = klass && klass.classTeacherId
    ? await User.findByPk(klass.classTeacherId, { attributes: ["id", "name"] })
    : null;

  let weightedScoreSum = 0;
  let weightedPassSum = 0;
  let weightSum = 0;

  const modules = classModules.map((cm) => {
    const mod = cm.Module;
    const markRow = marksByModule[mod.id];
    const score = markRow ? markRow.score : null;
    // Per-module status is judged against that module's own passing line —
    // this stays purely informational (shown per row on the report) and no
    // longer drives the overall result on its own.
    const status = score === null ? "NOT RECORDED" : score >= mod.passingLine ? "PASS" : "FAIL";

    if (score !== null) {
      // Normalize to a percentage of this module's own max score, so modules
      // marked out of different totals (e.g. 100 vs 50) combine fairly.
      const percentage = (score / mod.maxScore) * 100;
      const passPercentage = (mod.passingLine / mod.maxScore) * 100;
      weightedScoreSum += percentage * mod.moduleWeight;
      weightedPassSum += passPercentage * mod.moduleWeight;
      weightSum += mod.moduleWeight;
    }

    return {
      moduleId: mod.id,
      title: mod.moduleTitle,
      code: mod.moduleCode,
      type: mod.moduleType,
      teacherName: teacherNameByModule[mod.id] || null,
      score,
      maxScore: mod.maxScore,
      passingLine: mod.passingLine,
      weight: mod.moduleWeight,
      status,
    };
  });

  // Grouped by type — specific modules first, then general, then
  // complementary — so the report table can show one merged "Module Type"
  // cell spanning each group's rows, instead of repeating the type on every
  // line.
  const TYPE_ORDER = { specific: 0, general: 1, complementary: 2 };
  modules.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));

  const weightedAverage = weightSum > 0 ? +(weightedScoreSum / weightSum).toFixed(2) : null;
  // The overall pass line is itself a weighted average — of each recorded
  // module's own passing line — computed the exact same way as the score,
  // so a student passes overall precisely when their weighted average clears
  // the weighted average of what they needed. A single weak module can be
  // outweighed by strong performance elsewhere; it no longer fails the
  // report card on its own.
  const weightedPassLine = weightSum > 0 ? +(weightedPassSum / weightSum).toFixed(2) : null;
  const overallResult =
    weightedAverage === null ? "INCOMPLETE" : weightedAverage >= weightedPassLine ? "PASS" : "FAIL";

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      class: klass ? klass.name : null,
      classCategory: klass ? klass.category : null,
      admissionNumber: student.admissionNumber,
      guardianName: student.guardianName,
    },
    term: term.name,
    academicYear: academicYear ? academicYear.name : null,
    modules,
    weightedAverage,
    weightedPassLine,
    overallResult,
    classTeacherRemark: remark ? remark.comment : null,
    classTeacherName: classTeacher ? classTeacher.name : null,
  };
}

/**
 * Ranks all students in a class for a given term by weighted average (descending).
 * Standard competition ranking: ties share the same rank.
 */
async function rankClass(classId, termId) {
  // The roster for this class/year comes from StudentEnrollment, not the
  // live Student.classId — otherwise a student who has since been moved to
  // a new class would silently vanish from an old term's class report.
  // Records created before enrollment-tracking existed fall back to a live
  // classId match so nothing already in the database goes missing.
  const [enrollments, liveStudents] = await Promise.all([
    StudentEnrollment.findAll({ where: { classId }, include: [Student] }),
    Student.findAll({ where: { classId } }),
  ]);
  const byId = new Map();
  enrollments.forEach((e) => {
    if (e.Student) byId.set(e.Student.id, e.Student);
  });
  liveStudents.forEach((s) => {
    if (!byId.has(s.id)) byId.set(s.id, s);
  });
  const students = [...byId.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));

  const reports = await Promise.all(
    students.map((s) => buildStudentReport(s.id, termId))
  );

  const withScores = reports
    .filter((r) => r && r.weightedAverage !== null)
    .sort((a, b) => b.weightedAverage - a.weightedAverage);

  let rank = 0;
  let lastScore = null;
  withScores.forEach((r, idx) => {
    if (r.weightedAverage !== lastScore) {
      rank = idx + 1;
      lastScore = r.weightedAverage;
    }
    r.classRank = rank;
    // Total number of students actually ranked (i.e. with at least one
    // recorded mark this term) — shown on the report as "class rank out of
    // this many", e.g. "1 out of 5".
    r.classRankTotal = withScores.length;
  });

  return reports; // includes students with no marks yet (classRank undefined)
}

/**
 * Builds a term-over-term progress view for one student across all terms
 * in their class's academic year.
 */
async function buildStudentProgress(studentId) {
  const student = await Student.findByPk(studentId, { include: [Class] });
  if (!student) return null;

  const terms = await Term.findAll({
    where: { academicYearId: student.Class.academicYearId },
    order: [["id", "ASC"]],
  });

  const perTerm = await Promise.all(
    terms.map(async (t) => ({
      term: t.name,
      report: await buildStudentReport(studentId, t.id),
    }))
  );

  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
    progress: perTerm.map((pt) => ({
      term: pt.term,
      weightedAverage: pt.report ? pt.report.weightedAverage : null,
      weightedPassLine: pt.report ? pt.report.weightedPassLine : null,
      overallResult: pt.report ? pt.report.overallResult : null,
      modules: pt.report ? pt.report.modules : [],
    })),
  };
}

module.exports = { buildStudentReport, rankClass, buildStudentProgress, resolveClassIdForYear };
