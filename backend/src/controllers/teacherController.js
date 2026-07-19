const bcrypt = require("bcryptjs");
const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateTempPassword = require("../utils/generatePassword");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");
const { logActivity } = require("../utils/activityLogger");

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

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "teacher.created",
    description: `Added teacher ${teacher.name}`,
    entityType: "teacher",
    entityId: teacher.id,
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

// POST /api/teachers/:id/reset-password — a manager forces a brand new
// temporary password for a teacher who forgot theirs. Unlike
// getTeacherTempPassword (which only recovers a still-unused temp password),
// this works even after the teacher already changed their password once,
// since it issues a new one rather than just decrypting the old one.
const resetTeacherPassword = asyncHandler(async (req, res) => {
  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  const tempPassword = generateTempPassword();
  teacher.passwordHash = await bcrypt.hash(tempPassword, 10);
  teacher.mustChangePassword = true;
  teacher.tempPasswordEncrypted = encryptTempPassword(tempPassword);
  teacher.tempPasswordSetAt = new Date();
  teacher.tempPasswordSetBy = req.user.id;
  // Invalidate any token(s) already issued to this teacher — otherwise a
  // still-open session (or one they never logged out of) would keep working
  // right up until they happen to log out, even though their password just
  // changed out from under them.
  teacher.tokenVersion += 1;
  await teacher.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "teacher.password_reset",
    description: `Reset password for teacher ${teacher.name}`,
    entityType: "teacher",
    entityId: teacher.id,
  });

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
    temporaryPassword: tempPassword,
  });
});

// DELETE /api/teachers/:id — a manager permanently removes a teacher account.
// Blocked if the teacher has recorded any marks: those marks are graded work
// tied to real students and terms, and deleting the teacher out from under
// them would either orphan that data or silently destroy it. If a teacher
// truly needs to go despite recorded marks, deactivate them instead (see
// updateTeacherStatus) — that revokes access without losing academic
// records.
const deleteTeacher = asyncHandler(async (req, res) => {
  const { Mark, Class, TeacherModuleAssignment, sequelize } = require("../models");

  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  const recordedMarksCount = await Mark.count({ where: { recordedBy: teacher.id } });
  if (recordedMarksCount > 0) {
    throw ApiError.conflict(
      `${teacher.name} has recorded ${recordedMarksCount} mark${
        recordedMarksCount > 1 ? "s" : ""
      } and can't be deleted. Deactivate the account instead to revoke access while keeping their academic records intact.`
    );
  }

  await sequelize.transaction(async (t) => {
    // No marks exist, so any module assignments this teacher held are safe
    // to clear — otherwise they'd be left pointing at a deleted user.
    await TeacherModuleAssignment.destroy({ where: { teacherId: teacher.id }, transaction: t });
    // Likewise, if they were set as a class's homeroom/class teacher,
    // clear that reference rather than leave it dangling.
    await Class.update(
      { classTeacherId: null },
      { where: { classTeacherId: teacher.id }, transaction: t }
    );
    await teacher.destroy({ transaction: t });
  });

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "teacher.deleted",
    description: `Deleted teacher ${teacher.name}`,
    entityType: "teacher",
    entityId: teacher.id,
  });

  res.json({ message: "Teacher deleted successfully" });
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

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: status === "active" ? "teacher.activated" : "teacher.deactivated",
    description: `${status === "active" ? "Activated" : "Deactivated"} teacher ${teacher.name}`,
    entityType: "teacher",
    entityId: teacher.id,
  });

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, status: teacher.status },
  });
});

module.exports = {
  createTeacher,
  listTeachers,
  getTeacherTempPassword,
  resetTeacherPassword,
  updateTeacherStatus,
  deleteTeacher,
};
