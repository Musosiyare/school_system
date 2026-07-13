const { Class, Student, User, Module, AcademicYear, Term } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { rankClass } = require("../services/reportService");

// How many students show up in the school-wide "top performers" list.
const TOP_PERFORMERS_LIMIT = 2;
// How many students show up per class in the "top learners" list.
const TOP_PER_CLASS_LIMIT = 3;

// GET /api/statistics?termId=optional
// Manager-only, school-scoped statistics: enrollment/gender breakdowns are
// always available; academic rankings (top learners, pass rate, etc.) only
// appear once a term is resolved (explicit ?termId=, otherwise the current
// academic year's most recent term) and only reflect students with at
// least one recorded mark that term.
const getSchoolStatistics = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;

  const currentYear = await AcademicYear.findOne({
    where: { schoolId, isCurrent: true },
    include: [Term],
  });

  // Scoped to the current academic year's classes, same as the rest of the
  // app (Classes/Reports/Assignments pages all work off "this year" only).
  const classes = await Class.findAll({
    where: currentYear ? { schoolId, academicYearId: currentYear.id } : { schoolId },
    order: [["name", "ASC"]],
  });

  const students = await Student.findAll({
    where: { schoolId, status: "active" },
    attributes: ["id", "classId", "firstName", "lastName", "sex"],
  });

  const studentsByClass = {};
  students.forEach((s) => {
    if (!studentsByClass[s.classId]) studentsByClass[s.classId] = [];
    studentsByClass[s.classId].push(s);
  });

  const boys = students.filter((s) => s.sex === "M").length;
  const girls = students.filter((s) => s.sex === "F").length;

  const [totalTeachers, activeTeachers, totalModules] = await Promise.all([
    User.count({ where: { schoolId, role: "teacher" } }),
    User.count({ where: { schoolId, role: "teacher", status: "active" } }),
    Module.count({ where: { schoolId } }),
  ]);

  const availableTerms = currentYear
    ? (currentYear.Terms || [])
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((t) => ({ id: t.id, name: t.name }))
    : [];

  // Resolve which term academic rankings are computed for: an explicit
  // ?termId if it belongs to this school's current year, otherwise the
  // latest term of the current year, otherwise none.
  let term = null;
  if (req.query.termId) {
    term = availableTerms.find((t) => String(t.id) === String(req.query.termId)) || null;
  } else if (availableTerms.length > 0) {
    term = availableTerms[availableTerms.length - 1];
  }

  const classGenderBreakdown = classes.map((c) => {
    const list = studentsByClass[c.id] || [];
    return {
      classId: c.id,
      className: c.name,
      totalStudents: list.length,
      boys: list.filter((s) => s.sex === "M").length,
      girls: list.filter((s) => s.sex === "F").length,
    };
  });

  let academic = null;

  if (term) {
    const perClass = await Promise.all(
      classes.map(async (c) => ({
        classId: c.id,
        className: c.name,
        reports: await rankClass(c.id, term.id),
      }))
    );

    let allRanked = [];
    let totalWeighted = 0;
    let weightedCount = 0;
    let passCount = 0;

    const classBreakdown = perClass.map(({ classId, className, reports }) => {
      const ranked = reports.filter((r) => r && r.weightedAverage !== null);

      ranked.forEach((r) => {
        totalWeighted += r.weightedAverage;
        weightedCount += 1;
        if (r.overallResult === "PASS") passCount += 1;
        allRanked.push({ ...r, classId, className });
      });

      const top = ranked
        .slice()
        .sort((a, b) => b.weightedAverage - a.weightedAverage)
        .slice(0, TOP_PER_CLASS_LIMIT)
        .map((r) => ({
          studentId: r.student.id,
          name: r.student.name,
          weightedAverage: r.weightedAverage,
          classRank: r.classRank,
        }));

      const classAverage = ranked.length
        ? +(ranked.reduce((sum, r) => sum + r.weightedAverage, 0) / ranked.length).toFixed(2)
        : null;
      const classPassRate = ranked.length
        ? +((ranked.filter((r) => r.overallResult === "PASS").length / ranked.length) * 100).toFixed(1)
        : null;

      return {
        classId,
        className,
        studentsRanked: ranked.length,
        classAverage,
        classPassRate,
        topLearners: top,
      };
    });

    const schoolAverage = weightedCount ? +(totalWeighted / weightedCount).toFixed(2) : null;
    const schoolPassRate = weightedCount ? +((passCount / weightedCount) * 100).toFixed(1) : null;

    const topPerformers = allRanked
      .slice()
      .sort((a, b) => b.weightedAverage - a.weightedAverage)
      .slice(0, TOP_PERFORMERS_LIMIT)
      .map((r) => ({
        studentId: r.student.id,
        name: r.student.name,
        classId: r.classId,
        className: r.className,
        weightedAverage: r.weightedAverage,
      }));

    const rankedClasses = classBreakdown.filter((c) => c.classAverage !== null);
    const bestClass = rankedClasses.slice().sort((a, b) => b.classAverage - a.classAverage)[0] || null;

    // A class is only ever flagged as "needs attention" when its average
    // genuinely falls short of a comfortable pass margin — e.g. an 85%
    // average is never weak, even if it happens to be the lowest of the
    // bunch. Below this line is when it's actually worth a manager's
    // attention.
    const WEAK_CLASS_THRESHOLD = 70;
    const lowestClass =
      rankedClasses.length > 1
        ? rankedClasses.slice().sort((a, b) => a.classAverage - b.classAverage)[0]
        : null;
    const weakestClass = lowestClass && lowestClass.classAverage < WEAK_CLASS_THRESHOLD ? lowestClass : null;

    academic = {
      studentsRanked: weightedCount,
      schoolAverage,
      schoolPassRate,
      topPerformers,
      bestClass: bestClass ? { classId: bestClass.classId, className: bestClass.className, average: bestClass.classAverage } : null,
      weakestClass: weakestClass
        ? { classId: weakestClass.classId, className: weakestClass.className, average: weakestClass.classAverage }
        : null,
      classBreakdown,
    };
  }

  res.json({
    academicYear: currentYear ? { id: currentYear.id, name: currentYear.name } : null,
    availableTerms,
    term: term ? { id: term.id, name: term.name } : null,
    overview: {
      totalStudents: students.length,
      boys,
      girls,
      totalClasses: classes.length,
      totalTeachers,
      activeTeachers,
      totalModules,
    },
    classGenderBreakdown,
    academic,
  });
});

module.exports = { getSchoolStatistics };
