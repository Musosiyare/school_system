const ExcelJS = require("exceljs");
const { Student, StudentEnrollment, Class, Mark, ReportRemark, School, User, AcademicYear } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateStudentId = require("../utils/generateStudentId");
const { getCurrentAcademicYear, assertCurrentYear } = require("../utils/academicYear");
const { generateStudentListPdf, generateStudentRosterPdf } = require("../services/pdfService");
const { logActivity } = require("../utils/activityLogger");
const { getPermanentlyDismissedStudentIds, hasMisconductRecords } = require("../services/conductService");
const { issueCredential } = require("./portalCredentialController");

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
    dob: dob || null,
    sex: sex || null,
    guardianName: guardianName || null,
    guardianPhone: guardianPhone || null,
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

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "student.created",
    description: `Added student ${student.firstName} ${student.lastName} to ${klass.name}`,
    entityType: "student",
    entityId: student.id,
  });

  // Auto-provision a student portal account right away — no separate
  // "create account" step for staff to remember. The one-time temp
  // password is included in this response only (never logged) so whoever
  // registered the student can hand it over/print it immediately; it can
  // still be recovered later via the portal-credentials "peek" endpoint
  // until the student changes it.
  const portalCredential = await issueCredential({ student, issuedByUserId: req.user.id });

  res.status(201).json({ student, portalCredential });
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

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "student.updated",
    description: `Updated details for student ${student.firstName} ${student.lastName}`,
    entityType: "student",
    entityId: student.id,
  });

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

  // Same protection, but for SBMS's misconduct history — see
  // conductService.hasMisconductRecords for why this can't be a normal FK
  // constraint (SBMS is a separate app/repo sharing this database).
  if (await hasMisconductRecords(student.id)) {
    throw ApiError.conflict(
      "This student has misconduct records in the Behavior system and can't be deleted. Set their status to inactive instead.",
      "STUDENT_HAS_MISCONDUCT_RECORDS"
    );
  }

  await ReportRemark.destroy({ where: { studentId: student.id } });
  const studentName = `${student.firstName} ${student.lastName}`;
  const studentId = student.id;
  await student.destroy();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "student.deleted",
    description: `Deleted student ${studentName}`,
    entityType: "student",
    entityId: studentId,
  });

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

  // Flag anyone SBMS's discipline office has ever permanently dismissed —
  // regardless of which term that decision was made in — so the manager
  // can spot them at a glance in the class roster instead of having to
  // open each student's report cards to find out.
  const dismissedIds = await getPermanentlyDismissedStudentIds(students.map((s) => s.id));
  const studentsWithDismissal = students.map((s) => ({
    ...s.toJSON(),
    dismissedPermanently: dismissedIds.has(s.id),
  }));

  res.json({ students: studentsWithDismissal });
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

  // A printable roster should reflect who's actually enrolled — same as
  // getStudentRosterPdf below, inactive students are left off.
  const students = (await getClassRoster(req.params.id)).filter((s) => s.status !== "inactive");

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

// GET /api/classes/:id/students/excel — a well-formatted, downloadable
// roster for a single class (open to both managers and teachers, same
// class-suspension guard as listStudentsByClass). Unlike the PDF version
// this is meant to be worked with — reopened, filtered, sorted, pasted
// elsewhere — so it's a plain styled worksheet rather than a print layout,
// and it leads with the total headcount since that's the number a class
// teacher usually needs at a glance.
const getClassStudentListExcel = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
    include: [{ model: User, as: "classTeacher", attributes: ["name"] }],
  });
  if (!klass) throw ApiError.notFound("Class not found");
  if (req.user.role === "teacher" && klass.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
  }

  const school = await School.findByPk(req.schoolId);
  const academicYear = await AcademicYear.findByPk(klass.academicYearId);
  // Same as the PDF roster — this headcount banner should only reflect
  // students currently active in the class.
  const students = (await getClassRoster(req.params.id)).filter((s) => s.status !== "inactive");
  if (students.length === 0) {
    throw ApiError.badRequest("This class has no active students to export.");
  }
  const boysCount = students.filter((s) => s.sex === "M").length;
  const girlsCount = students.filter((s) => s.sex === "F").length;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = school?.name || "EduManage Pro";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Students", {
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  const TEAL_DARK = "FF0F766E";
  const BORDER = { style: "thin", color: { argb: "FFCBD5E1" } };

  sheet.columns = [
    { width: 20 }, // Admission Number
    { width: 34 }, // Student Names
    { width: 12 }, // Sex
  ];

  // --- Header block ---
  sheet.mergeCells("A1:C1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = school?.name || "EduManage Pro";
  titleCell.font = { bold: true, size: 15, color: { argb: TEAL_DARK } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells("A2:C2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `Class Roster — ${klass.name}${academicYear ? ` (${academicYear.name})` : ""}`;
  subtitleCell.font = { italic: true, size: 11, color: { argb: "FF475569" } };

  sheet.getCell("A3").value = "Class Teacher:";
  sheet.getCell("A3").font = { bold: true, size: 10 };
  sheet.mergeCells("B3:C3");
  sheet.getCell("B3").value = klass.classTeacher?.name || "—";
  sheet.getCell("B3").font = { size: 10 };

  sheet.getCell("A4").value = "Generated:";
  sheet.getCell("A4").font = { bold: true, size: 10 };
  sheet.mergeCells("B4:C4");
  sheet.getCell("B4").value = new Date().toLocaleDateString();
  sheet.getCell("B4").font = { size: 10 };

  // Headline total/boys/girls banner, in the same teal used for the table
  // header — the only place color shows up outside the header row.
  sheet.mergeCells("A5:C5");
  const totalCell = sheet.getCell("A5");
  totalCell.value = `Total Students: ${students.length}   |   Boys: ${boysCount}   |   Girls: ${girlsCount}`;
  totalCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  totalCell.alignment = { vertical: "middle", horizontal: "left" };
  totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_DARK } };
  sheet.getRow(5).height = 22;

  sheet.getRow(6).height = 6; // spacer

  // --- Table header (row 8, matching the frozen split above) ---
  const headerRow = sheet.getRow(8);
  headerRow.values = ["Admission No.", "Student Names", "Sex"];
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_DARK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });

  // Data rows stay plain white — color is reserved for the header/banner so
  // the roster itself stays easy to read and print.
  const firstDataRow = 9;
  students.forEach((s, idx) => {
    const rowNum = firstDataRow + idx;
    const row = sheet.getRow(rowNum);
    row.values = [
      s.admissionNumber || "",
      `${s.firstName} ${s.lastName}`,
      s.sex === "M" ? "Male" : s.sex === "F" ? "Female" : "",
    ];
    row.eachCell((cell, colNumber) => {
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center" };
    });
  });

  if (students.length > 0) {
    sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: 3 } };
  } else {
    sheet.mergeCells(`A${firstDataRow}:C${firstDataRow}`);
    const emptyCell = sheet.getCell(`A${firstDataRow}`);
    emptyCell.value = "No students enrolled in this class yet.";
    emptyCell.font = { italic: true, size: 10, color: { argb: "FF94A3B8" } };
    emptyCell.alignment = { horizontal: "center" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeClass = klass.name.replace(/[^a-z0-9]+/gi, "-");
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="students-${safeClass}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
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

// PATCH /api/students/:studentId/status — flips a student between
// active/inactive. This is the alternative the delete-blocking errors
// above point people to: a student with marks or SBMS misconduct history
// can't be deleted without destroying that record, but can still be taken
// off the active roster. Purely a status flag — doesn't touch class,
// enrollment, marks, or SBMS's own records at all.
const setStudentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "inactive"].includes(status)) {
    throw ApiError.badRequest("status must be 'active' or 'inactive'", "status");
  }

  const student = await Student.findOne({
    where: { id: req.params.studentId, schoolId: req.schoolId },
  });
  if (!student) throw ApiError.notFound("Student not found");

  student.status = status;
  await student.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "student.status_changed",
    description: `Marked student ${student.firstName} ${student.lastName} as ${status}`,
    entityType: "student",
    entityId: student.id,
  });

  res.json({ student });
});

module.exports = {
  createStudent,
  updateStudent,
  deleteStudent,
  setStudentStatus,
  listStudentsByClass,
  getClassStudentListPdf,
  getClassStudentListExcel,
  getStudentRosterPdf,
  getClassRoster,
};
