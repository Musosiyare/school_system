const { Class, ClassModule, Module, User, AcademicYear, Mark } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/classes
const createClass = asyncHandler(async (req, res) => {
  const { name, academicYearId } = req.body;
  if (!name || !academicYearId) {
    throw ApiError.badRequest("name and academicYearId are required");
  }

  const year = await AcademicYear.findOne({
    where: { id: academicYearId, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.badRequest("Invalid academicYearId for this school");

  const klass = await Class.create({ schoolId: req.schoolId, academicYearId, name });
  res.status(201).json({ class: klass });
});

// GET /api/classes
const listClasses = asyncHandler(async (req, res) => {
  const classes = await Class.findAll({
    where: { schoolId: req.schoolId },
    include: [
      { model: User, as: "classTeacher", attributes: ["id", "name", "email"] },
      AcademicYear,
      { model: ClassModule, include: [Module] },
    ],
    order: [["name", "ASC"]],
  });
  res.json({ classes });
});

// GET /api/classes/:id — single class detail (used by the "Manage" modal)
const getClass = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
    include: [
      { model: User, as: "classTeacher", attributes: ["id", "name", "email"] },
      { model: ClassModule, include: [Module] },
    ],
  });
  if (!klass) throw ApiError.notFound("Class not found");
  res.json({ class: klass });
});

// PUT /api/classes/:id/modules — REPLACE the full set of modules taught in a class (FR-2.4)
// Sending the complete desired list makes this safe to drive from a checkbox UI.
const setClassModules = asyncHandler(async (req, res) => {
  const { moduleIds } = req.body; // array of module ids (can be empty to clear all)
  if (!Array.isArray(moduleIds)) {
    throw ApiError.badRequest("moduleIds must be an array");
  }

  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");

  if (moduleIds.length > 0) {
    const modules = await Module.findAll({ where: { id: moduleIds, schoolId: req.schoolId } });
    if (modules.length !== moduleIds.length) {
      throw ApiError.badRequest("One or more moduleIds are invalid for this school");
    }
  }

  const existing = await ClassModule.findAll({ where: { classId: klass.id } });
  const existingIds = existing.map((cm) => cm.moduleId);
  const toRemove = existingIds.filter((id) => !moduleIds.includes(id));
  const toAdd = moduleIds.filter((id) => !existingIds.includes(id));

  // Refuse to remove a module that already has marks recorded for this class,
  // to avoid silently orphaning recorded data.
  if (toRemove.length > 0) {
    const markCount = await Mark.count({ where: { classId: klass.id, moduleId: toRemove } });
    if (markCount > 0) {
      throw ApiError.conflict(
        "One or more modules you're removing already have marks recorded for this class. Remove those marks first if you really need to unassign the module.",
        "MODULE_HAS_MARKS"
      );
    }
  }

  await ClassModule.destroy({ where: { classId: klass.id, moduleId: toRemove } });
  await Promise.all(toAdd.map((moduleId) => ClassModule.create({ classId: klass.id, moduleId })));

  const updated = await ClassModule.findAll({ where: { classId: klass.id }, include: [Module] });
  res.json({ classModules: updated });
});

// POST /api/classes/:id/assign-teacher — assign or unassign the class teacher (FR-2.6)
// Send { teacherId: null } to unassign.
const assignClassTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.body;

  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");

  if (teacherId === null || teacherId === undefined) {
    klass.classTeacherId = null;
    await klass.save();
    return res.json({ class: klass });
  }

  const teacher = await User.findOne({
    where: { id: teacherId, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.badRequest("Invalid teacherId for this school");

  klass.classTeacherId = teacherId;
  await klass.save();

  res.json({ class: klass });
});

module.exports = { createClass, listClasses, getClass, setClassModules, assignClassTeacher };
