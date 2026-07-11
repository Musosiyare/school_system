const bcrypt = require("bcryptjs");
const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateTempPassword = require("../utils/generatePassword");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");

// POST /api/teachers (FR-3.1)
const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) throw ApiError.badRequest("name and email are required");

  const existing = await User.findOne({ where: { email } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const teacher = await User.create({
    schoolId: req.schoolId,
    name,
    email,
    phone,
    passwordHash,
    role: "teacher",
    mustChangePassword: true,
    // Kept in recoverable form until the teacher changes it themselves,
    // in case whoever created the account forgets to hand it over / loses it.
    tempPasswordEncrypted: encryptTempPassword(tempPassword),
    tempPasswordSetAt: new Date(),
    tempPasswordSetBy: req.user.id,
  });

  res.status(201).json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
    temporaryPassword: tempPassword,
  });
});

const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await User.findAll({
    where: { schoolId: req.schoolId, role: "teacher" },
    attributes: [
      "id",
      "name",
      "email",
      "phone",
      "status",
      "mustChangePassword",
      "tempPasswordSetAt",
    ],
    order: [["name", "ASC"]],
  });
  res.json({ teachers });
});

// GET /api/teachers/:id/temp-password — lets a manager recover a forgotten
// temporary password, but only until the teacher has changed it themselves
// (at which point it's cleared and this returns 404).
const getTeacherTempPassword = asyncHandler(async (req, res) => {
  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");
  if (!teacher.tempPasswordEncrypted) {
    throw ApiError.notFound(
      "No recoverable temporary password on file — this teacher has already changed it."
    );
  }

  res.json({
    temporaryPassword: decryptTempPassword(teacher.tempPasswordEncrypted),
    setAt: teacher.tempPasswordSetAt,
  });
});

// PATCH /api/teachers/:id/status — a manager activates or deactivates a
// teacher account within their own school. A deactivated ("suspended")
// teacher is rejected on their very next request: authenticate() re-checks
// the user's status against the database on every call, so this takes
// effect immediately rather than only on their next login.
const updateTeacherStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    throw ApiError.badRequest("status must be 'active' or 'suspended'", "status");
  }

  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  teacher.status = status;
  await teacher.save();

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, status: teacher.status },
  });
});

module.exports = { createTeacher, listTeachers, getTeacherTempPassword, updateTeacherStatus };
