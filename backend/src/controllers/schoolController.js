const bcrypt = require("bcryptjs");
const { School, User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateTempPassword = require("../utils/generatePassword");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");

// POST /api/schools — creates school + first Manager + temp credentials (FR-1.1, FR-1.2)
const createSchool = asyncHandler(async (req, res) => {
  const { name, address, phone, email, logoUrl, manager } = req.body;

  if (!name) throw ApiError.badRequest("School name is required", "name");
  if (!manager || !manager.name || !manager.email) {
    throw ApiError.badRequest("manager.name and manager.email are required", "manager");
  }

  const existing = await User.findOne({ where: { email: manager.email } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const school = await School.create({ name, address, phone, email, logoUrl });

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const managerUser = await User.create({
    schoolId: school.id,
    name: manager.name,
    email: manager.email,
    phone: manager.phone || null,
    passwordHash,
    role: "manager",
    mustChangePassword: true,
    tempPasswordEncrypted: encryptTempPassword(tempPassword),
    tempPasswordSetAt: new Date(),
    tempPasswordSetBy: req.user.id,
  });

  res.status(201).json({
    school: { id: school.id, name: school.name, status: school.status },
    manager: {
      id: managerUser.id,
      email: managerUser.email,
      temporaryPassword: tempPassword,
      mustChangePassword: true,
    },
  });
});

const listSchools = asyncHandler(async (req, res) => {
  const schools = await School.findAll({ order: [["createdAt", "DESC"]] });

  // Pull each school's manager along for display in the schools table (name,
  // email, phone) and to know whether a recoverable temp password is on file,
  // without exposing the password itself here.
  const managers = await User.findAll({
    where: { role: "manager" },
    attributes: ["schoolId", "name", "email", "phone", "tempPasswordSetAt"],
  });
  const managerBySchool = Object.fromEntries(managers.map((m) => [m.schoolId, m]));

  const enriched = schools.map((s) => {
    const manager = managerBySchool[s.id];
    return {
      ...s.toJSON(),
      // s.phone (spread from s.toJSON() above) is the school's own contact
      // number. managerPhone below is deliberately a separate field — the
      // manager's personal phone — and must not overwrite/shadow it.
      managerName: manager?.name || null,
      managerEmail: manager?.email || null,
      managerPhone: manager?.phone || null,
      managerHasTempPassword: !!manager?.tempPasswordSetAt,
    };
  });

  res.json({ schools: enriched });
});

// GET /api/schools/stats — platform-wide counters for the superuser dashboard.
const getPlatformStats = asyncHandler(async (req, res) => {
  const { Class, Student } = require("../models");
  const { Op, fn, col } = require("sequelize");

  const [totalSchools, activeSchools, suspendedSchools] = await Promise.all([
    School.count(),
    School.count({ where: { status: "active" } }),
    School.count({ where: { status: "suspended" } }),
  ]);

  const [totalTeachers, activeTeachers, totalManagers, activeManagers] = await Promise.all([
    User.count({ where: { role: "teacher" } }),
    User.count({ where: { role: "teacher", status: "active" } }),
    User.count({ where: { role: "manager" } }),
    User.count({ where: { role: "manager", status: "active" } }),
  ]);

  const [totalStudents, activeStudents, totalClasses] = await Promise.all([
    Student.count(),
    Student.count({ where: { status: "active" } }),
    Class.count(),
  ]);

  // Per-school breakdown: active teachers, active students, and classes.
  const [teacherRows, studentRows, classRows] = await Promise.all([
    User.findAll({
      where: { role: "teacher", status: "active", schoolId: { [Op.ne]: null } },
      attributes: ["schoolId", [fn("COUNT", col("id")), "count"]],
      group: ["schoolId"],
      raw: true,
    }),
    Student.findAll({
      where: { status: "active" },
      attributes: ["schoolId", [fn("COUNT", col("id")), "count"]],
      group: ["schoolId"],
      raw: true,
    }),
    Class.findAll({
      attributes: ["schoolId", [fn("COUNT", col("id")), "count"]],
      group: ["schoolId"],
      raw: true,
    }),
  ]);

  const toMap = (rows) =>
    Object.fromEntries(rows.map((r) => [r.schoolId, parseInt(r.count, 10)]));
  const teacherCounts = toMap(teacherRows);
  const studentCounts = toMap(studentRows);
  const classCounts = toMap(classRows);

  const schools = await School.findAll({
    attributes: ["id", "name", "status"],
    order: [["name", "ASC"]],
  });

  const perSchool = schools.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    activeTeachers: teacherCounts[s.id] || 0,
    activeStudents: studentCounts[s.id] || 0,
    classes: classCounts[s.id] || 0,
  }));

  res.json({
    totals: {
      totalSchools,
      activeSchools,
      suspendedSchools,
      totalTeachers,
      activeTeachers,
      totalManagers,
      activeManagers,
      totalStudents,
      activeStudents,
      totalClasses,
    },
    perSchool,
  });
});

// PATCH /api/schools/:id — activate/suspend (FR-1.4)
const updateSchoolStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    throw ApiError.badRequest("status must be 'active' or 'suspended'", "status");
  }
  const school = await School.findByPk(req.params.id);
  if (!school) throw ApiError.notFound("School not found");

  school.status = status;
  await school.save();
  res.json({ school });
});

// POST /api/schools/:id/reset-manager-credentials (FR-1.3)
const resetManagerCredentials = asyncHandler(async (req, res) => {
  const school = await School.findByPk(req.params.id);
  if (!school) throw ApiError.notFound("School not found");

  const manager = await User.findOne({ where: { schoolId: school.id, role: "manager" } });
  if (!manager) throw ApiError.notFound("No manager account found for this school");

  const tempPassword = generateTempPassword();
  manager.passwordHash = await bcrypt.hash(tempPassword, 10);
  manager.mustChangePassword = true;
  manager.tempPasswordEncrypted = encryptTempPassword(tempPassword);
  manager.tempPasswordSetAt = new Date();
  manager.tempPasswordSetBy = req.user.id;
  await manager.save();

  res.json({
    manager: { id: manager.id, email: manager.email, temporaryPassword: tempPassword },
  });
});

// GET /api/schools/:id/manager-temp-password — recover a forgotten temp
// password instead of resetting it outright. Only works until the manager
// has changed their own password (it's cleared automatically at that point).
const getManagerTempPassword = asyncHandler(async (req, res) => {
  const school = await School.findByPk(req.params.id);
  if (!school) throw ApiError.notFound("School not found");

  const manager = await User.findOne({ where: { schoolId: school.id, role: "manager" } });
  if (!manager) throw ApiError.notFound("No manager account found for this school");
  if (!manager.tempPasswordEncrypted) {
    throw ApiError.notFound(
      "No recoverable temporary password on file — this manager has already changed it."
    );
  }

  res.json({
    manager: { id: manager.id, email: manager.email },
    temporaryPassword: decryptTempPassword(manager.tempPasswordEncrypted),
    setAt: manager.tempPasswordSetAt,
  });
});

// GET /api/schools/me — a manager viewing their own school's profile.
const getMySchool = asyncHandler(async (req, res) => {
  const school = await School.findByPk(req.schoolId);
  if (!school) throw ApiError.notFound("School not found");
  res.json({ school });
});

// PATCH /api/schools/me — a manager editing their own school's information.
// Deliberately excludes `status`: activating/suspending a school is a
// platform-level decision reserved for the superuser (see updateSchoolStatus).
const updateMySchool = asyncHandler(async (req, res) => {
  const { name, address, phone, email, logoUrl } = req.body;
  const school = await School.findByPk(req.schoolId);
  if (!school) throw ApiError.notFound("School not found");

  if (name !== undefined) {
    if (!name.trim()) throw ApiError.badRequest("School name is required", "name");
    school.name = name;
  }
  if (address !== undefined) school.address = address;
  if (phone !== undefined) school.phone = phone;
  if (email !== undefined) school.email = email;
  if (logoUrl !== undefined) school.logoUrl = logoUrl;

  await school.save();
  res.json({ school });
});

module.exports = {
  createSchool,
  listSchools,
  updateSchoolStatus,
  resetManagerCredentials,
  getManagerTempPassword,
  getMySchool,
  updateMySchool,
  getPlatformStats,
};
