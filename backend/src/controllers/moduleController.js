const { Module, Class, ClassModule, TeacherModuleAssignment, Mark } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Module weight and max score used to be two separate fields that were
// always meant to be the same number in practice, which just meant filling
// the same value in twice. Module weight is now the single source of truth:
// it's both "how much this module counts toward the weighted average" AND
// "the highest score a teacher can enter for it". maxScore is kept as a
// column internally (report/PDF/marks code reads it) but is always set to
// mirror moduleWeight automatically — callers never set it directly.
function validateModuleFields({ moduleWeight, passingLine }) {
  if (moduleWeight !== undefined && moduleWeight <= 0) {
    throw ApiError.badRequest("moduleWeight must be a positive number", "moduleWeight");
  }
  if (passingLine !== undefined && moduleWeight !== undefined && (passingLine < 0 || passingLine > moduleWeight)) {
    throw ApiError.badRequest(`passingLine must be between 0 and ${moduleWeight}`, "passingLine");
  }
}

// POST /api/modules (FR-2.3)
// Optionally accepts classIds so a module can be assigned to the classes that
// teach it right at creation time, instead of a separate trip to the Classes
// "Manage" screen.
const createModule = asyncHandler(async (req, res) => {
  const { moduleCode, moduleTitle, moduleWeight, passingLine, classIds } = req.body;

  if (!moduleCode || !moduleTitle) {
    throw ApiError.badRequest("moduleCode and moduleTitle are required");
  }
  validateModuleFields({ moduleWeight, passingLine });

  if (classIds !== undefined && !Array.isArray(classIds)) {
    throw ApiError.badRequest("classIds must be an array", "classIds");
  }

  const existing = await Module.findOne({ where: { schoolId: req.schoolId, moduleCode } });
  if (existing) throw ApiError.conflict("A module with this code already exists in your school");

  let classes = [];
  if (classIds && classIds.length > 0) {
    classes = await Class.findAll({ where: { id: classIds, schoolId: req.schoolId } });
    if (classes.length !== classIds.length) {
      throw ApiError.badRequest("One or more classIds are invalid for this school", "classIds");
    }
  }

  const resolvedWeight = moduleWeight ?? 1;
  const module = await Module.create({
    schoolId: req.schoolId,
    moduleCode,
    moduleTitle,
    moduleWeight: resolvedWeight,
    maxScore: resolvedWeight, // mirrors weight — see note above
    passingLine: passingLine ?? 50,
  });

  if (classes.length > 0) {
    await ClassModule.bulkCreate(classes.map((c) => ({ classId: c.id, moduleId: module.id })));
  }

  res.status(201).json({ module });
});

const listModules = asyncHandler(async (req, res) => {
  const modules = await Module.findAll({
    where: { schoolId: req.schoolId },
    include: [{ model: ClassModule, include: [Class] }],
    order: [["moduleTitle", "ASC"]],
  });
  res.json({ modules });
});

// PATCH /api/modules/:id — edit a module
const updateModule = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!module) throw ApiError.notFound("Module not found");

  const { moduleCode, moduleTitle, moduleWeight, passingLine } = req.body;
  validateModuleFields({
    moduleWeight: moduleWeight ?? module.moduleWeight,
    passingLine: passingLine ?? module.passingLine,
  });

  if (moduleCode && moduleCode !== module.moduleCode) {
    const existing = await Module.findOne({ where: { schoolId: req.schoolId, moduleCode } });
    if (existing) throw ApiError.conflict("A module with this code already exists in your school");
    module.moduleCode = moduleCode;
  }
  if (moduleTitle !== undefined) module.moduleTitle = moduleTitle;
  if (moduleWeight !== undefined) {
    module.moduleWeight = moduleWeight;
    module.maxScore = moduleWeight; // keep mirrored — see note above
  }
  if (passingLine !== undefined) module.passingLine = passingLine;

  await module.save();
  res.json({ module });
});

// DELETE /api/modules/:id — only allowed if the module has no recorded marks
const deleteModule = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!module) throw ApiError.notFound("Module not found");

  const markCount = await Mark.count({ where: { moduleId: module.id } });
  if (markCount > 0) {
    throw ApiError.conflict(
      "This module already has marks recorded against it and can't be deleted. Remove its marks first, or keep the module and just stop assigning it to classes.",
      "MODULE_HAS_MARKS"
    );
  }

  await ClassModule.destroy({ where: { moduleId: module.id } });
  await TeacherModuleAssignment.destroy({ where: { moduleId: module.id } });
  await module.destroy();

  res.json({ message: "Module deleted" });
});

module.exports = { createModule, listModules, updateModule, deleteModule };
