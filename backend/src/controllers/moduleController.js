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
const MODULE_TYPES = ["specific", "general", "complementary"];

// Specific modules require 70% to pass; general and complementary modules
// only require 50%. passingLine is always derived from this — it's never
// accepted as raw input from the client.
const PASS_PERCENTAGE_BY_TYPE = {
  specific: 0.7,
  general: 0.5,
  complementary: 0.5,
};

function computePassingLine(moduleType, moduleWeight) {
  const pct = PASS_PERCENTAGE_BY_TYPE[moduleType] ?? 0.5;
  return +(moduleWeight * pct).toFixed(2);
}

function validateModuleFields({ moduleWeight, moduleType }) {
  if (moduleWeight !== undefined && moduleWeight <= 0) {
    throw ApiError.badRequest("moduleWeight must be a positive number", "moduleWeight");
  }
  if (moduleType !== undefined && !MODULE_TYPES.includes(moduleType)) {
    throw ApiError.badRequest(
      `moduleType must be one of: ${MODULE_TYPES.join(", ")}`,
      "moduleType"
    );
  }
}

// POST /api/modules (FR-2.3)
// Optionally accepts classIds so a module can be assigned to the classes that
// teach it right at creation time, instead of a separate trip to the Classes
// "Manage" screen.
const createModule = asyncHandler(async (req, res) => {
  const { moduleCode, moduleTitle, moduleWeight, moduleType, classIds } = req.body;

  if (!moduleCode || !moduleTitle) {
    throw ApiError.badRequest("moduleCode and moduleTitle are required");
  }
  validateModuleFields({ moduleWeight, moduleType });

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
  const resolvedType = moduleType ?? "general";
  const module = await Module.create({
    schoolId: req.schoolId,
    moduleCode,
    moduleTitle,
    moduleWeight: resolvedWeight,
    maxScore: resolvedWeight, // mirrors weight — see note above
    moduleType: resolvedType,
    // Always derived from type + weight — 70% for specific modules, 50% for
    // general/complementary. Never accepted as raw client input.
    passingLine: computePassingLine(resolvedType, resolvedWeight),
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

  const { moduleCode, moduleTitle, moduleWeight, moduleType } = req.body;
  validateModuleFields({
    moduleWeight: moduleWeight ?? module.moduleWeight,
    moduleType: moduleType ?? module.moduleType,
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
  if (moduleType !== undefined) module.moduleType = moduleType;

  // Re-derive passingLine any time weight or type changed, so it always
  // reflects "70% for specific, 50% for general/complementary".
  if (moduleWeight !== undefined || moduleType !== undefined) {
    module.passingLine = computePassingLine(module.moduleType, module.moduleWeight);
  }

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
