const { Class, Student, StudentEnrollment, User, Module, AcademicYear, Term, School } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { rankClass } = require("../services/reportService");
const { generateSchoolNumbersReportPdf } = require("../services/pdfService");

// How many students show up in the school-wide "top performers" list.
const TOP_PERFORMERS_LIMIT = 2;
// How many students show up per class in the "top learners" list.
const TOP_PER_CLASS_LIMIT = 3;

// Resolves which academic year a request should be scoped to: an explicit
// ?academicYearId (manager only — that's how the manager browses an
// archived year's statistics read-only), otherwise the school's current
// year.
async function resolveViewingYear(req) {
  if (req.query.academicYearId) {
    if (req.user.role !== "manager") {
      throw ApiError.forbidden("Only a school manager can view a past academic year");
    }
    const year = await AcademicYear.findOne({
      where: { id: req.query.academicYearId, schoolId: req.schoolId },
      include: [Term],
    });
    if (!year) throw ApiError.badRequest("Invalid academicYearId for this school");
    return year;
  }
  return AcademicYear.findOne({ where: { schoolId: req.schoolId, isCurrent: true }, include: [Term] });
}

// Builds { classId: [students...] } for a set of classes using
// StudentEnrollment (the historically-correct roster), falling back to a
// live classId match for anything that predates enrollment-tracking.
async function getStudentsByClass(classIds) {
  const [enrollments, liveStudents] = await Promise.all([
    StudentEnrollment.findAll({ where: { classId: classIds }, include: [Student] }),
    Student.findAll({ where: { classId: classIds, status: "active" } }),
  ]);
  const byClass = {};
  const seen = new Set();
  enrollments.forEach((e) => {
    if (!e.Student || e.Student.status !== "active") return;
    if (!byClass[e.classId]) byClass[e.classId] = [];
    byClass[e.classId].push(e.Student);
    seen.add(e.Student.id);
  });
  liveStudents.forEach((s) => {
    if (seen.has(s.id)) return;
    if (!byClass[s.classId]) byClass[s.classId] = [];
    byClass[s.classId].push(s);
  });
  return byClass;
}

// GET /api/statistics?termId=optional&academicYearId=optional
// Manager-only, school-scoped statistics: enrollment/gender breakdowns are
// always available; academic rankings (top learners, pass rate, etc.) only
// appear once a term is resolved (explicit ?termId=, otherwise the viewed
// year's most recent term) and only reflect students with at least one
// recorded mark that term.
const getSchoolStatistics = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;

  const currentYear = await resolveViewingYear(req);

  // Scoped to the viewed academic year's classes, same as the rest of the
  // app (Classes/Reports/Assignments pages all work off one year at a time).
  const classes = await Class.findAll({
    where: currentYear ? { schoolId, academicYearId: currentYear.id } : { schoolId },
    order: [["name", "ASC"]],
  });

  const studentsByClass = await getStudentsByClass(classes.map((c) => c.id));
  const students = Object.values(studentsByClass).flat();

  const boys = students.filter((s) => s.sex === "M").length;
  const girls = students.filter((s) => s.sex === "F").length;
  // Ranked reports (from rankClass) carry the student's id but not their
  // sex, so this map lets the academic-performance block below tag each
  // ranked student with M/F without a second query.
  const sexById = new Map(students.map((s) => [s.id, s.sex]));

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
  // first term of the current year (Term 1), otherwise none.
  let term = null;
  if (req.query.termId) {
    term = availableTerms.find((t) => String(t.id) === String(req.query.termId)) || null;
  } else if (availableTerms.length > 0) {
    term = availableTerms[0];
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

    // Boys-vs-girls academic performance for the same term — reuses
    // allRanked (already filtered to students with a recorded weighted
    // average) and tags each one with sex via sexById, so a student who
    // hasn't been marked yet doesn't skew either side.
    const genderTotals = {
      M: { count: 0, sum: 0, passCount: 0 },
      F: { count: 0, sum: 0, passCount: 0 },
    };
    allRanked.forEach((r) => {
      const sex = sexById.get(r.student.id);
      if (sex !== "M" && sex !== "F") return;
      genderTotals[sex].count += 1;
      genderTotals[sex].sum += r.weightedAverage;
      if (r.overallResult === "PASS") genderTotals[sex].passCount += 1;
    });
    const genderPerformance = ["M", "F"].reduce((acc, sex) => {
      const g = genderTotals[sex];
      acc[sex] = {
        studentsRanked: g.count,
        average: g.count ? +(g.sum / g.count).toFixed(2) : null,
        passRate: g.count ? +((g.passCount / g.count) * 100).toFixed(1) : null,
      };
      return acc;
    }, {});

    academic = {
      studentsRanked: weightedCount,
      schoolAverage,
      schoolPassRate,
      genderPerformance: { boys: genderPerformance.M, girls: genderPerformance.F },
      topPerformers,
      bestClass: bestClass ? { classId: bestClass.classId, className: bestClass.className, average: bestClass.classAverage } : null,
      weakestClass: weakestClass
        ? { classId: weakestClass.classId, className: weakestClass.className, average: weakestClass.classAverage }
        : null,
      classBreakdown,
    };
  }

  res.json({
    academicYear: currentYear ? { id: currentYear.id, name: currentYear.name, isCurrent: currentYear.isCurrent } : null,
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

// GET /api/statistics/years-comparison — enrollment (total/boys/girls) for
// every academic year the school has ever had, so the manager can compare
// e.g. 2026-2027 against 2027-2028 on the Statistics page. Each year is
// computed the same way as the main overview (StudentEnrollment first,
// falling back to a live classId match), just looped across all years
// instead of the single viewed one.
const getYearsComparison = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;

  const years = await AcademicYear.findAll({
    where: { schoolId },
    order: [["id", "ASC"]],
  });

  const results = await Promise.all(
    years.map(async (year) => {
      const classes = await Class.findAll({ where: { schoolId, academicYearId: year.id } });
      const studentsByClass = await getStudentsByClass(classes.map((c) => c.id));
      const students = Object.values(studentsByClass).flat();
      const boys = students.filter((s) => s.sex === "M").length;
      const girls = students.filter((s) => s.sex === "F").length;
      return {
        academicYearId: year.id,
        name: year.name,
        isCurrent: year.isCurrent,
        totalStudents: students.length,
        boys,
        girls,
        totalClasses: classes.length,
      };
    })
  );

  res.json({ years: results });
});

// GET /api/statistics/report/pdf — the "Get School Report" button on the
// manager's Statistics page. A numbers-only PDF: total enrollment, gender
// split, class/teacher/module counts, and a per-class breakdown table.
// Deliberately excludes any student names or personal details — this is a
// headcount report, not a roster.
const getSchoolNumbersReportPdf = asyncHandler(async (req, res) => {
  const schoolId = req.schoolId;

  const school = await School.findByPk(schoolId);

  const currentYear = await resolveViewingYear(req);

  const classes = await Class.findAll({
    where: currentYear ? { schoolId, academicYearId: currentYear.id } : { schoolId },
    order: [["name", "ASC"]],
  });

  const studentsByClass = await getStudentsByClass(classes.map((c) => c.id));
  const students = Object.values(studentsByClass).flat();

  const boys = students.filter((s) => s.sex === "M").length;
  const girls = students.filter((s) => s.sex === "F").length;

  const [totalTeachers, activeTeachers, totalModules] = await Promise.all([
    User.count({ where: { schoolId, role: "teacher" } }),
    User.count({ where: { schoolId, role: "teacher", status: "active" } }),
    Module.count({ where: { schoolId } }),
  ]);

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

  const pdfBuffer = await generateSchoolNumbersReportPdf(
    {
      academicYearName: currentYear?.name || null,
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
      schoolPhone: school.phone,
      schoolEmail: school.email,
      schoolAddress: school.address,
      generatedAt: new Date().toLocaleDateString(),
    },
    school.name
  );

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="school-report-${(school.name || "school").replace(/\s+/g, "-")}.pdf"`,
  });
  res.send(pdfBuffer);
});

module.exports = { getSchoolStatistics, getSchoolNumbersReportPdf, getYearsComparison };
