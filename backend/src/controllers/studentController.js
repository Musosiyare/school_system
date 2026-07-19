const { Student, StudentEnrollment, Class, Mark, ReportRemark, School, User, AcademicYear } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateStudentId = require("../utils/generateStudentId");
const { getCurrentAcademicYear, assertCurrentYear } = require("../utils/academicYear");
const { generateStudentListPdf, generateStudentRosterPdf } = require("../services/pdfService");

// POST /api/students — always enrolls into a class in the current academic
// year, and records that enrollment so this year's roster stays correct
// even after the student is later moved to a different class.
const createStudent = asyncHandler(async (req, res) => {
  const { classId, firstName, lastName, dob, sex, guardianName, guardianPhone } = req.body;

  if (!classId || !firstName || !lastName) {
    throw ApiError.badRequest("classId, firstName and lastName are required");
  }

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.badRequest("Invalid classId for this school");
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  const academicYear = await AcademicYear.findByPk(klass.academicYearId);

  const student = await Student.create({
    schoolId: req.schoolId,
    classId,
    firstName,
    lastName,
    dob,
    sex,
    guardianName,
    guardianPhone,
  });

  // The admission number is generated after the row exists so it can use
  // the student's own auto-increment id as its "insertion id" segment —
  // see generateStudentId.js for the full format.
  student.admissionNumber = generateStudentId({
    schoolId: req.schoolId,
    className: klass.name,
    academicYearName: academicYear ? academicYear.name : null,
    insertionId: student.id,
  });
  await student.save();

  await StudentEnrollment.create({
    studentId: student.id,
    classId,
    academicYearId: klass.academicYearId,
    schoolId: req.schoolId,
  });

  res.status(201).json({ student });
});

// PUT /api/students/:studentId
// Everything except the admission number can be edited — that stays
// server-generated and immutable, the same way it's server-generated on
// create.
const updateStudent = asyncHandler(async (req, res) => {
  const { classId, firstName, lastName, dob, sex, guardianName, guardianPhone } = req.body;

  const student = await Student.findOne({
    where: { id: req.params.studentId, schoolId: req.schoolId },
  });
  if (!student) throw ApiError.notFound("Student not found");

  if (!firstName || !lastName) {
    throw ApiError.badRequest("firstName and lastName are required");
  }

  if (classId && Number(classId) !== student.classId) {
    const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
    if (!klass) throw ApiError.badRequest("Invalid classId for this school");
    // A student can only ever be moved INTO a class in the current academic
    // year — that's what keeps past years' rosters frozen. To revisit an
    // old year, switch the viewing year instead of editing students into it.
    await assertCurrentYear(klass.academicYearId, req.schoolId);
    student.classId = classId;

    // Record (or update) this year's enrollment so the new class's roster
    // picks the student up, without touching any prior year's enrollment
    // row — that's what keeps last year's class report intact.
    await StudentEnrollment.upsert({
      studentId: student.id,
      classId,
      academicYearId: klass.academicYearId,
      schoolId: req.schoolId,
    });
  }

  student.firstName = firstName;
  student.lastName = lastName;
  student.dob = dob || null;
  student.sex = sex || null;
  student.guardianName = guardianName || null;
  student.guardianPhone = guardianPhone || null;

  await student.save();

  res.json({ student });
});

// DELETE /api/students/:studentId — only allowed if the student has no
// recorded marks, same protection deleteModule uses: deleting a student
// who already has marks would silently destroy that academic record.
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    where: { id: req.params.studentId, schoolId: req.schoolId },
  });
  if (!student) throw ApiError.notFound("Student not found");

  const studentClass = await Class.findByPk(student.classId);
  if (studentClass) await assertCurrentYear(studentClass.academicYearId, req.schoolId);

  const markCount = await Mark.count({ where: { studentId: student.id } });
  if (markCount > 0) {
    throw ApiError.conflict(
      "This student already has marks recorded and can't be deleted. Remove their marks first, or set their status to inactive instead.",
      "STUDENT_HAS_MARKS"
    );
  }

  await ReportRemark.destroy({ where: { studentId: student.id } });
  await student.destroy();

  res.json({ message: "Student deleted" });
});

// Resolves a class's roster via StudentEnrollment (the historically-correct
// source), falling back to a live classId match for any student that
// predates enrollment-tracking so nothing already in the database goes
// missing. Since a class only ever belongs to one academic year, this
// naturally gives the right roster whether the class is the current year's
// or an archived one.
async function getClassRoster(classId) {
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
  return [...byId.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));
}

// GET /api/classes/:id/students
const listStudentsByClass = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  if (req.user.role === "teacher" && klass.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
  }

  const students = await getClassRoster(req.params.id);

  res.json({ students });
});

// GET /api/classes/:id/students/pdf — manager's printable roster for a
// class: every enrolled student with DOB, sex and guardian contact info.
const getClassStudentListPdf = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
    include: [{ model: User, as: "classTeacher", attributes: ["name"] }],
  });
  if (!klass) throw ApiError.notFound("Class not found");

  const school = await School.findByPk(req.schoolId);
  const academicYear = await AcademicYear.findByPk(klass.academicYearId);

  const students = await getClassRoster(req.params.id);

  const rows = students.map((s) => ({
    admissionNumber: s.admissionNumber,
    name: `${s.firstName} ${s.lastName}`,
    dob: s.dob ? new Date(s.dob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null,
    sex: s.sex === "M" ? "Male" : s.sex === "F" ? "Female" : null,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
  }));

  const pdfBuffer = await generateStudentListPdf(
    {
      className: klass.name,
      academicYearName: academicYear ? academicYear.name : null,
      classTeacherName: klass.classTeacher?.name || null,
      schoolPhone: school.phone,
      schoolEmail: school.email,
      schoolAddress: school.address,
      rows,
      generatedAt: new Date().toLocaleDateString(),
    },
    school.name
  );

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="students-${klass.name.replace(/\s+/g, "-")}.pdf"`,
  });
  res.send(pdfBuffer);
});

// GET /api/students/roster/pdf?classId=&gender=all|M|F&academicYearId= — the
// "Get Student List" button on the manager's Statistics page. Unlike
// getClassStudentListPdf (a per-class guardian-contact sheet), this covers
// either one class or the whole school, can be narrowed to boys/girls/all,
// and deliberately leaves guardian details off the page. ?academicYearId
// lets a manager pull the list for an archived year (same convention as
// /statistics); it's ignored when a specific classId is given, since a
// class already belongs to exactly one year.
const getStudentRosterPdf = asyncHandler(async (req, res) => {
  const { classId, gender, academicYearId } = req.query;
  const genderFilter = ["M", "F"].includes(gender) ? gender : "all";

  const school = await School.findByPk(req.schoolId);

  let className = null;
  let classTeacherName = null;
  let academicYear = null;

  let students;
  if (classId) {
    const klass = await Class.findOne({
      where: { id: classId, schoolId: req.schoolId },
      include: [{ model: User, as: "classTeacher", attributes: ["name"] }],
    });
    if (!klass) throw ApiError.notFound("Class not found");
    className = klass.name;
    classTeacherName = klass.classTeacher?.name || null;
    academicYear = await AcademicYear.findByPk(klass.academicYearId);

    students = (await getClassRoster(classId)).filter(
      (s) => s.status === "active" && (genderFilter === "all" || s.sex === genderFilter)
    );
  } else {
    academicYear = academicYearId
      ? await AcademicYear.findOne({ where: { id: academicYearId, schoolId: req.schoolId } })
      : await getCurrentAcademicYear(req.schoolId);
    if (!academicYear) throw ApiError.badRequest("Invalid or missing academicYearId for this school");

    const where = { schoolId: req.schoolId, status: "active" };
    if (genderFilter !== "all") where.sex = genderFilter;

    students = await Student.findAll({
      where,
      include: [{ model: Class, where: { academicYearId: academicYear.id }, required: true }],
    });
  }
  students = students.slice().sort((a, b) => a.firstName.localeCompare(b.firstName));

  const rows = students.map((s) => ({
    admissionNumber: s.admissionNumber,
    name: `${s.firstName} ${s.lastName}`,
    dob: s.dob ? new Date(s.dob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null,
    sex: s.sex === "M" ? "Male" : s.sex === "F" ? "Female" : null,
    className: classId ? className : s.Class?.name || null,
  }));

  const genderLabel = genderFilter === "M" ? "Boys Only" : genderFilter === "F" ? "Girls Only" : "All Students";

  const pdfBuffer = await generateStudentRosterPdf(
    {
      scope: classId ? "class" : "school",
      className,
      academicYearName: academicYear ? academicYear.name : null,
      classTeacherName,
      genderLabel,
      schoolPhone: school.phone,
      schoolEmail: school.email,
      schoolAddress: school.address,
      rows,
      generatedAt: new Date().toLocaleDateString(),
    },
    school.name
  );

  const scopePart = classId ? className.replace(/\s+/g, "-") : "whole-school";
  const genderPart = genderFilter === "all" ? "" : `-${genderFilter === "M" ? "boys" : "girls"}`;

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="students-${scopePart}${genderPart}.pdf"`,
  });
  res.send(pdfBuffer);
});

module.exports = {
  createStudent,
  updateStudent,
  deleteStudent,
  listStudentsByClass,
  getClassStudentListPdf,
  getStudentRosterPdf,
};
