const { Student, Class, Mark, ReportRemark, School, User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateStudentId = require("../utils/generateStudentId");
const { generateStudentListPdf } = require("../services/pdfService");

// POST /api/students
const createStudent = asyncHandler(async (req, res) => {
  const { classId, firstName, lastName, dob, sex, guardianName, guardianPhone } = req.body;

  if (!classId || !firstName || !lastName) {
    throw ApiError.badRequest("classId, firstName and lastName are required");
  }

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.badRequest("Invalid classId for this school");

  // Student ID is never typed in by hand — it's a random 6-digit code
  // generated here, so every student gets one automatically at enrollment.
  const admissionNumber = await generateStudentId();

  const student = await Student.create({
    schoolId: req.schoolId,
    classId,
    firstName,
    lastName,
    dob,
    sex,
    guardianName,
    guardianPhone,
    admissionNumber,
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

  if (classId) {
    const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
    if (!klass) throw ApiError.badRequest("Invalid classId for this school");
    student.classId = classId;
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

// GET /api/classes/:id/students
const listStudentsByClass = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");

  const students = await Student.findAll({
    where: { classId: req.params.id },
    order: [["firstName", "ASC"]],
  });

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

  const students = await Student.findAll({
    where: { classId: req.params.id },
    order: [["firstName", "ASC"]],
  });

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

module.exports = {
  createStudent,
  updateStudent,
  deleteStudent,
  listStudentsByClass,
  getClassStudentListPdf,
};
