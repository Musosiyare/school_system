const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateTempPassword = require("../utils/generatePassword");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");
const { logActivity } = require("../utils/activityLogger");

// Any endpoint that looks up "a teacher by id" needs to also match
// discipline-only accounts (role: "discipline") — otherwise actions like
// viewing credentials, deactivating, or changing their SBMS role would
// silently 404 for exactly the accounts the Disciplinary Staff page is
// meant to manage. Real teacher-only actions (creating/listing on the
// Teachers page) still filter strictly on role: "teacher".
const STAFF_ROLES = ["teacher", "discipline"];

// A discipline-only account (role: "discipline") was never a real teacher —
// it exists purely for SBMS — so activity log entries about it should read
// "discipline staff", not "teacher". A real teacher who also happens to
// hold an SBMS role (disciplineRole set, role still "teacher") keeps being
// logged as a teacher; only the account TYPE decides the wording here, not
// whether an SBMS role is attached.
const staffNoun = (account) => (account.role === "discipline" ? "discipline staff" : "teacher");
const staffActionPrefix = (account) => (account.role === "discipline" ? "discipline" : "teacher");

// POST /api/teachers (FR-3.1)
// disciplineRole is optional — the Disciplinary Staff page passes it so
// creating a Dean of Discipline / Disciplinary Officer account is one call
// instead of create-then-patch. disciplineOnly marks an account that only
// exists for SBMS and was never a real teacher — it gets role: "discipline"
// instead of role: "teacher", which is what actually keeps it out of every
// teacher-only route in this system (see User.js). The plain Teachers page
// never sends either field, so ordinary teacher creation is unaffected.
const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, phone, disciplineRole, disciplineOnly } = req.body;
  if (!name || !email) throw ApiError.badRequest("name and email are required");
  if (disciplineRole !== undefined && disciplineRole !== null && !["dean_of_discipline", "disciplinary_officer"].includes(disciplineRole)) {
    throw ApiError.badRequest("disciplineRole must be 'dean_of_discipline', 'disciplinary_officer', or omitted", "disciplineRole");
  }
  if (disciplineOnly && !disciplineRole) {
    throw ApiError.badRequest("An SBMS role is required when creating a discipline-only account", "disciplineRole");
  }

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
    role: disciplineOnly ? "discipline" : "teacher",
    disciplineRole: disciplineRole || null,
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
    action: disciplineOnly ? "discipline.created" : "teacher.created",
    description: disciplineOnly
      ? `Added ${teacher.name} as discipline staff (${disciplineRole.replace(/_/g, " ")})`
      : disciplineRole
      ? `Added teacher ${teacher.name} as ${disciplineRole.replace(/_/g, " ")}`
      : `Added teacher ${teacher.name}`,
    entityType: disciplineOnly ? "discipline" : "teacher",
    entityId: teacher.id,
  });

  res.status(201).json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, disciplineRole: teacher.disciplineRole },
    temporaryPassword: tempPassword,
  });
});

const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await User.findAll({
    // role: "teacher" strictly — a discipline-only account has role:
    // "discipline" now, so it's naturally excluded here without needing a
    // separate flag. A real teacher who also holds a discipline role keeps
    // role: "teacher" and still shows up, disciplineRole and all.
    where: { schoolId: req.schoolId, role: "teacher" },
    attributes: [
      "id",
      "name",
      "email",
      "phone",
      "status",
      "mustChangePassword",
      "tempPasswordSetAt",
      "disciplineRole",
    ],
    order: [["name", "ASC"]],
  });
  res.json({ teachers });
});

// GET /api/teachers/disciplinary-staff — everyone relevant to SBMS: every
// discipline-only account (role: "discipline"), PLUS any real teacher who
// currently also holds a discipline role. A discipline-only account whose
// role was just cleared still shows up here (matched by role alone) so
// it's never orphaned — reachable to reassign, deactivate, or delete.
const listDisciplinaryStaff = asyncHandler(async (req, res) => {
  const staff = await User.findAll({
    where: {
      schoolId: req.schoolId,
      [Op.or]: [{ role: "discipline" }, { role: "teacher", disciplineRole: { [Op.not]: null } }],
    },
    attributes: [
      "id",
      "name",
      "email",
      "phone",
      "status",
      "role",
      "disciplineRole",
      "mustChangePassword",
      "tempPasswordSetAt",
    ],
    order: [["disciplineRole", "ASC"], ["name", "ASC"]],
  });
  res.json({ staff });
});

// GET /api/teachers/:id/temp-password — lets a manager recover a forgotten
// temporary password, but only until the teacher has changed it themselves
// (at which point it's cleared and this returns 404).
const getTeacherTempPassword = asyncHandler(async (req, res) => {
  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
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
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
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
    action: `${staffActionPrefix(teacher)}.password_reset`,
    description: `Reset password for ${staffNoun(teacher)} ${teacher.name}`,
    entityType: staffActionPrefix(teacher),
    entityId: teacher.id,
  });

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
    temporaryPassword: tempPassword,
  });
});

// PATCH /api/teachers/:id — a manager edits a teacher's name, email, or phone.
// Password/status/deletion have their own dedicated endpoints, so this only
// ever touches these three profile fields.
const updateTeacher = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) throw ApiError.badRequest("name and email are required");

  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  if (email !== teacher.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw ApiError.conflict("A user with this email already exists");
  }

  teacher.name = name;
  teacher.email = email;
  teacher.phone = phone || null;
  await teacher.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: `${staffActionPrefix(teacher)}.updated`,
    description: `Updated details for ${staffNoun(teacher)} ${teacher.name}`,
    entityType: staffActionPrefix(teacher),
    entityId: teacher.id,
  });

  res.json({
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      status: teacher.status,
    },
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
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
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
    action: `${staffActionPrefix(teacher)}.deleted`,
    description: `Deleted ${staffNoun(teacher)} ${teacher.name}`,
    entityType: staffActionPrefix(teacher),
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
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  teacher.status = status;
  await teacher.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: `${staffActionPrefix(teacher)}.${status === "active" ? "activated" : "deactivated"}`,
    description: `${status === "active" ? "Activated" : "Deactivated"} ${staffNoun(teacher)} ${teacher.name}`,
    entityType: staffActionPrefix(teacher),
    entityId: teacher.id,
  });

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, status: teacher.status },
  });
});

// PATCH /api/teachers/:id/discipline-role — a manager assigns or clears the
// SBMS role for one of their teachers. `null` revokes it. This is the only
// place this field is ever written from — SBMS itself only ever reads it.
const updateDisciplineRole = asyncHandler(async (req, res) => {
  const { disciplineRole } = req.body;
  if (disciplineRole !== null && !["dean_of_discipline", "disciplinary_officer"].includes(disciplineRole)) {
    throw ApiError.badRequest("disciplineRole must be 'dean_of_discipline', 'disciplinary_officer', or null", "disciplineRole");
  }

  const teacher = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: { [Op.in]: STAFF_ROLES } },
  });
  if (!teacher) throw ApiError.notFound("Teacher not found");

  teacher.disciplineRole = disciplineRole;
  await teacher.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "teacher.discipline_role_changed",
    description: disciplineRole
      ? `Set ${teacher.name}'s SBMS role to ${disciplineRole.replace(/_/g, " ")}`
      : `Removed ${teacher.name}'s SBMS role`,
    entityType: "teacher",
    entityId: teacher.id,
  });

  res.json({
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, disciplineRole: teacher.disciplineRole },
  });
});

module.exports = {
  createTeacher,
  listTeachers,
  listDisciplinaryStaff,
  getTeacherTempPassword,
  resetTeacherPassword,
  updateTeacher,
  updateTeacherStatus,
  updateDisciplineRole,
  deleteTeacher,
};
