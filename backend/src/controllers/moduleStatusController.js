const {
  Class,
  Module,
  ClassModule,
  Term,
  TeacherModuleAssignment,
  ClassModuleTermStatus,
} = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { assertCurrentYear } = require("../utils/academicYear");
const { logActivity } = require("../utils/activityLogger");

// Same shape of check markController.assertTeacherIsAssigned uses — a
// teacher may only ever touch the disabled/enabled status of a module they
// are actually assigned to teach in this class. A manager can touch any.
async function assertTeacherIsAssigned(userId, role, moduleId, classId) {
  if (role === "manager") return;
  const assignment = await TeacherModuleAssignment.findOne({
    where: { teacherId: userId, moduleId, classId },
  });
  if (!assignment) {
    throw ApiError.forbidden("You are not assigned to teach this module for this class");
  }
}

// GET /api/classes/:classId/term/:termId/module-status — every module
// taught in this class, alongside whether it's been disabled for this
// specific term. Used by the marks entry screen so a teacher can see (and
// toggle) the status of the module they're currently working on.
const listModuleStatus = asyncHandler(async (req, res) => {
  const { classId, termId } = req.params;

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  const term = await Term.findByPk(termId);
  if (!term || term.academicYearId !== klass.academicYearId) {
    throw ApiError.badRequest("Invalid termId for this class");
  }

  const [classModules, statuses] = await Promise.all([
    ClassModule.findAll({ where: { classId }, include: [Module] }),
    ClassModuleTermStatus.findAll({ where: { classId, termId } }),
  ]);
  const statusByModule = Object.fromEntries(statuses.map((s) => [s.moduleId, s]));

  const modules = classModules.map((cm) => {
    const status = statusByModule[cm.moduleId];
    return {
      moduleId: cm.moduleId,
      moduleTitle: cm.Module?.moduleTitle,
      moduleCode: cm.Module?.moduleCode,
      disabled: !!status?.disabled,
      disabledAt: status?.disabledAt || null,
    };
  });

  res.json({ modules });
});

// PATCH /api/classes/:classId/modules/:moduleId/term/:termId/status
// body: { disabled: boolean }
const setModuleStatus = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.params;
  const { disabled } = req.body;
  if (typeof disabled !== "boolean") {
    throw ApiError.badRequest("disabled (boolean) is required");
  }

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");

  const module = await Module.findOne({ where: { id: moduleId, schoolId: req.schoolId } });
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");

  const classModule = await ClassModule.findOne({ where: { classId, moduleId } });
  if (!classModule) throw ApiError.badRequest("This module is not assigned to this class");

  const term = await Term.findByPk(termId);
  if (!term || term.academicYearId !== klass.academicYearId) {
    throw ApiError.badRequest("Invalid termId for this class");
  }
  if (term.isLocked) throw ApiError.termLocked();

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));

  // Only the current academic year can ever be changed — exactly the same
  // rule marks/remarks already follow, so a past year's reports can never
  // be retroactively altered by disabling a module after the fact.
  await assertCurrentYear(term.academicYearId, req.schoolId);

  const [status] = await ClassModuleTermStatus.findOrCreate({
    where: { classId, moduleId, termId },
    defaults: { disabled: false },
  });
  status.disabled = disabled;
  status.disabledBy = disabled ? req.user.id : null;
  status.disabledAt = disabled ? new Date() : null;
  await status.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: disabled ? "module.disabled" : "module.enabled",
    description: `${disabled ? "Disabled" : "Re-enabled"} ${module.moduleTitle} for ${klass.name} — ${term.name}`,
    entityType: "class",
    entityId: Number(classId),
  });

  res.json({
    moduleId: Number(moduleId),
    disabled: status.disabled,
    disabledAt: status.disabledAt,
  });
});

module.exports = { listModuleStatus, setModuleStatus };
