const { Student, Class, Module, ClassModule, Mark, Term, ReportRemark, User, TeacherModuleAssignment } = require("../models");

/**
 * Builds the full report data for a single student in a single term.
 * Implements SRS section 5: Business Rules & Calculation Logic.
 */
async function buildStudentReport(studentId, termId) {
  const student = await Student.findByPk(studentId, { include: [Class] });
  if (!student) return null;

  const term = await Term.findByPk(termId);
  if (!term) return null;

  // All modules taught in this student's class
  const classModules = await ClassModule.findAll({
    where: { classId: student.classId },
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
    where: { classId: student.classId },
    include: [{ model: User, as: "teacher", attributes: ["id", "name"] }],
  });
  const teacherNameByModule = Object.fromEntries(
    moduleAssignments.map((a) => [a.moduleId, a.teacher?.name || null])
  );

  const remark = await ReportRemark.findOne({ where: { studentId, termId } });

  const classTeacher = student.Class && student.Class.classTeacherId
    ? await User.findByPk(student.Class.classTeacherId, { attributes: ["id", "name"] })
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
      class: student.Class ? student.Class.name : null,
      admissionNumber: student.admissionNumber,
      guardianName: student.guardianName,
    },
    term: term.name,
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
  const students = await Student.findAll({ where: { classId }, order: [["firstName", "ASC"]] });

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

module.exports = { buildStudentReport, rankClass, buildStudentProgress };
