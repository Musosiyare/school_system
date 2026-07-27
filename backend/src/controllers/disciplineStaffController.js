const bcrypt = require("bcryptjs");
const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateTempPassword = require("../utils/generatePassword");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");
const { logActivity } = require("../utils/activityLogger");

const DISCIPLINE_ROLES = ["dean_of_discipline", "disciplinary_officer"];

function assertValidDisciplineRole(disciplineRole, { allowNull = false } = {}) {
  if (allowNull && disciplineRole === null) return;
  if (!DISCIPLINE_ROLES.includes(disciplineRole)) {
    throw ApiError.badRequest(
      `disciplineRole must be ${allowNull ? "'dean_of_discipline', 'disciplinary_officer', or null" : "'dean_of_discipline' or 'disciplinary_officer'"}`,
      "disciplineRole"
    );
  }
}

// ---------------------------------------------------------------------------
// Standalone SBMS accounts (role: "discipline_staff") — people who only do
// discipline work and have no teaching/management duties here. They're
// created, listed, and managed from the Disciplinary Staff page, entirely
// separate from the Teachers list. They can never log into this app itself
// (see authController.login) — SBMS is the only thing that checks these
// credentials.
// ---------------------------------------------------------------------------

// POST /api/discipline-staff
const createDisciplineStaff = asyncHandler(async (req, res) => {
  const { name, email, phone, disciplineRole } = req.body;
  if (!name || !email) throw ApiError.badRequest("name and email are required");
  assertValidDisciplineRole(disciplineRole);

  const existing = await User.findOne({ where: { email } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const staff = await User.create({
    schoolId: req.schoolId,
    name,
    email,
    phone,
    passwordHash,
    role: "discipline_staff",
    disciplineRole,
    mustChangePassword: true,
    tempPasswordEncrypted: encryptTempPassword(tempPassword),
    tempPasswordSetAt: new Date(),
    tempPasswordSetBy: req.user.id,
  });

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.created",
    description: `Added SBMS ${disciplineRole.replace(/_/g, " ")} ${staff.name}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.status(201).json({
    staff: { id: staff.id, name: staff.name, email: staff.email, disciplineRole: staff.disciplineRole },
    temporaryPassword: tempPassword,
  });
});

// GET /api/discipline-staff — standalone accounts only.
const listDisciplineStaff = asyncHandler(async (req, res) => {
  const staff = await User.findAll({
    where: { schoolId: req.schoolId, role: "discipline_staff" },
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
  res.json({ staff });
});

// PATCH /api/discipline-staff/:id — edit name/email/phone.
const updateDisciplineStaff = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) throw ApiError.badRequest("name and email are required");

  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");

  if (email !== staff.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw ApiError.conflict("A user with this email already exists");
  }

  staff.name = name;
  staff.email = email;
  staff.phone = phone || null;
  await staff.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.updated",
    description: `Updated details for SBMS staff ${staff.name}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.json({
    staff: { id: staff.id, name: staff.name, email: staff.email, phone: staff.phone, status: staff.status },
  });
});

// PATCH /api/discipline-staff/:id/role — change dean_of_discipline <-> disciplinary_officer.
// Standalone accounts always carry one of the two — there's no "no role"
// state here, since the account exists for exactly this purpose. To remove
// someone from SBMS entirely, delete or suspend the account instead.
const updateStandaloneDisciplineRole = asyncHandler(async (req, res) => {
  const { disciplineRole } = req.body;
  assertValidDisciplineRole(disciplineRole);

  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");

  staff.disciplineRole = disciplineRole;
  await staff.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.role_changed",
    description: `Set ${staff.name}'s SBMS role to ${disciplineRole.replace(/_/g, " ")}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.json({
    staff: { id: staff.id, name: staff.name, email: staff.email, disciplineRole: staff.disciplineRole },
  });
});

// PATCH /api/discipline-staff/:id/status
const updateDisciplineStaffStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    throw ApiError.badRequest("status must be 'active' or 'suspended'", "status");
  }

  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");

  staff.status = status;
  await staff.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: status === "active" ? "discipline_staff.activated" : "discipline_staff.deactivated",
    description: `${status === "active" ? "Activated" : "Deactivated"} SBMS staff ${staff.name}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.json({
    staff: { id: staff.id, name: staff.name, email: staff.email, status: staff.status },
  });
});

// GET /api/discipline-staff/:id/temp-password
const getDisciplineStaffTempPassword = asyncHandler(async (req, res) => {
  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");
  if (!staff.tempPasswordEncrypted) {
    throw ApiError.notFound(
      "No recoverable temporary password on file — this account's password has already been changed."
    );
  }

  res.json({
    temporaryPassword: decryptTempPassword(staff.tempPasswordEncrypted),
    setAt: staff.tempPasswordSetAt,
  });
});

// POST /api/discipline-staff/:id/reset-password
const resetDisciplineStaffPassword = asyncHandler(async (req, res) => {
  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");

  const tempPassword = generateTempPassword();
  staff.passwordHash = await bcrypt.hash(tempPassword, 10);
  staff.mustChangePassword = true;
  staff.tempPasswordEncrypted = encryptTempPassword(tempPassword);
  staff.tempPasswordSetAt = new Date();
  staff.tempPasswordSetBy = req.user.id;
  staff.tokenVersion += 1;
  await staff.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.password_reset",
    description: `Reset password for SBMS staff ${staff.name}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.json({
    staff: { id: staff.id, name: staff.name, email: staff.email },
    temporaryPassword: tempPassword,
  });
});

// DELETE /api/discipline-staff/:id
const deleteDisciplineStaff = asyncHandler(async (req, res) => {
  const staff = await User.findOne({
    where: { id: req.params.id, schoolId: req.schoolId, role: "discipline_staff" },
  });
  if (!staff) throw ApiError.notFound("Discipline staff account not found");

  await staff.destroy();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.deleted",
    description: `Deleted SBMS staff ${staff.name}`,
    entityType: "discipline_staff",
    entityId: staff.id,
  });

  res.json({ message: "Discipline staff account deleted successfully" });
});

// ---------------------------------------------------------------------------
// Tagging an existing teacher or manager as discipline staff — a dual-purpose
// account that keeps its "teacher"/"manager" role (and full access to this
// app) but ALSO shows up in SBMS. This is deliberately separate from the
// standalone accounts above: tagging never creates a new login, it just sets
// disciplineRole on an account that already exists.
// ---------------------------------------------------------------------------

// GET /api/discipline-staff/taggable — every teacher + the manager in this
// school, with their current disciplineRole, so the UI can offer to
// tag/untag them without a second lookup.
const listTaggableStaff = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { schoolId: req.schoolId, role: ["teacher", "manager"] },
    attributes: ["id", "name", "email", "role", "status", "disciplineRole"],
    order: [["name", "ASC"]],
  });
  res.json({ staff: users });
});

// PATCH /api/discipline-staff/tag/:userId — set or clear disciplineRole on an
// existing teacher/manager account. null untags them from SBMS entirely.
const updateTaggedDisciplineRole = asyncHandler(async (req, res) => {
  const { disciplineRole } = req.body;
  assertValidDisciplineRole(disciplineRole, { allowNull: true });

  const user = await User.findOne({
    where: { id: req.params.userId, schoolId: req.schoolId, role: ["teacher", "manager"] },
  });
  if (!user) throw ApiError.notFound("Teacher or manager not found");

  user.disciplineRole = disciplineRole;
  await user.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "discipline_staff.tag_changed",
    description: disciplineRole
      ? `Tagged ${user.name} (${user.role}) as SBMS ${disciplineRole.replace(/_/g, " ")}`
      : `Removed ${user.name}'s SBMS tag`,
    entityType: "user",
    entityId: user.id,
  });

  res.json({
    staff: { id: user.id, name: user.name, email: user.email, role: user.role, disciplineRole: user.disciplineRole },
  });
});

module.exports = {
  createDisciplineStaff,
  listDisciplineStaff,
  updateDisciplineStaff,
  updateStandaloneDisciplineRole,
  updateDisciplineStaffStatus,
  getDisciplineStaffTempPassword,
  resetDisciplineStaffPassword,
  deleteDisciplineStaff,
  listTaggableStaff,
  updateTaggedDisciplineRole,
};
