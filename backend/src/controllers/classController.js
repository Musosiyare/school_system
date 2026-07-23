const {
  sequelize,
  Class,
  ClassModule,
  Module,
  User,
  AcademicYear,
  Mark,
  Student,
  StudentEnrollment,
  Term,
  TeacherModuleAssignment,
  Notification,
  ClassModuleTermStatus,
} = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { getCurrentAcademicYear, assertCurrentYear } = require("../utils/academicYear");
const { logActivity } = require("../utils/activityLogger");

const CLASS_CATEGORIES = ["TSS", "GE"];

// POST /api/classes — always created in the current academic year. Classes
// for a past year are never created after the fact; they only get read
// back when a manager switches to view that year.
const createClass = asyncHandler(async (req, res) => {
  const { name, academicYearId, category } = req.body;
  if (!name || !academicYearId) {
    throw ApiError.badRequest("name and academicYearId are required");
  }
  if (category && !CLASS_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("category must be either TSS or GE");
  }

  const year = await AcademicYear.findOne({
    where: { id: academicYearId, schoolId: req.schoolId },
  });
  if (!year) throw ApiError.badRequest("Invalid academicYearId for this school");
  await assertCurrentYear(academicYearId, req.schoolId);

  const klass = await Class.create({
    schoolId: req.schoolId,
    academicYearId,
    name,
    category: category || "GE",
  });

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "class.created",
    description: `Created class ${klass.name}`,
    entityType: "class",
    entityId: klass.id,
  });

  res.status(201).json({ class: klass });
});

// POST /api/classes/:id/clone — used from the pull-students screen when the
// destination year doesn't have a matching class yet (e.g. no "S2A" exists
// in 2026-2027 the first time L3 students are pulled into L4). Creates a new
// class in destAcademicYearId with the same category and module list as the
// source class, so students land somewhere already set up with the right
// subjects. The source class itself is never touched — this only adds a new
// class, same as the pull/promotion step only ever adds new records.
const cloneClass = asyncHandler(async (req, res) => {
  const { destAcademicYearId, name } = req.body;
  if (!destAcademicYearId) throw ApiError.badRequest("destAcademicYearId is required");

  const sourceClass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!sourceClass) throw ApiError.notFound("Class not found");

  const destYear = await AcademicYear.findOne({
    where: { id: destAcademicYearId, schoolId: req.schoolId },
  });
  if (!destYear) throw ApiError.badRequest("Invalid destAcademicYearId for this school");
  if (Number(destYear.id) === Number(sourceClass.academicYearId)) {
    throw ApiError.badRequest("destAcademicYearId must be different from the source class's year");
  }
  // Classes are only ever created in the current year (same rule as
  // createClass) — cloning into an archived year would silently mutate it.
  await assertCurrentYear(destYear.id, req.schoolId);

  const newName = (name && name.trim()) || sourceClass.name;

  const duplicate = await Class.findOne({
    where: { schoolId: req.schoolId, academicYearId: destYear.id, name: newName },
  });
  if (duplicate) {
    throw ApiError.conflict(
      `A class named "${newName}" already exists in ${destYear.name}.`,
      "DUPLICATE_CLASS_NAME"
    );
  }

  const sourceModules = await ClassModule.findAll({ where: { classId: sourceClass.id } });

  const newClass = await sequelize.transaction(async (t) => {
    const created = await Class.create(
      {
        schoolId: req.schoolId,
        academicYearId: destYear.id,
        name: newName,
        category: sourceClass.category,
      },
      { transaction: t }
    );

    if (sourceModules.length > 0) {
      await ClassModule.bulkCreate(
        sourceModules.map((cm) => ({ classId: created.id, moduleId: cm.moduleId })),
        { transaction: t }
      );
    }

    return created;
  });

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "class.created",
    description: `Cloned class ${sourceClass.name} into ${destYear.name} as ${newClass.name}`,
    entityType: "class",
    entityId: newClass.id,
  });

  res.status(201).json({ class: newClass });
});

// PATCH /api/classes/:id/name — rename a class. Only the current year's
// classes can be renamed (same rule as everything else that changes a
// class), and a duplicate name within the same academic year is rejected
// so two classes in one year can never end up with the same name.
const setClassName = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw ApiError.badRequest("name is required", "name");

  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  const trimmed = name.trim();
  if (trimmed !== klass.name) {
    const duplicate = await Class.findOne({
      where: { schoolId: req.schoolId, academicYearId: klass.academicYearId, name: trimmed },
    });
    if (duplicate && duplicate.id !== klass.id) {
      throw ApiError.conflict(
        `A class named "${trimmed}" already exists in this academic year.`,
        "DUPLICATE_CLASS_NAME"
      );
    }
  }

  const previousName = klass.name;
  klass.name = trimmed;
  await klass.save();

  if (previousName !== trimmed) {
    await logActivity({
      userId: req.user.id,
      schoolId: req.schoolId,
      action: "class.renamed",
      description: `Renamed class "${previousName}" to "${trimmed}"`,
      entityType: "class",
      entityId: klass.id,
    });
  }

  res.json({ class: klass });
});

// PATCH /api/classes/:id/category — change a class's TSS/GE track after creation
const setClassCategory = asyncHandler(async (req, res) => {
  const { category } = req.body;
  if (!CLASS_CATEGORIES.includes(category)) {
    throw ApiError.badRequest("category must be either TSS or GE");
  }

  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  klass.category = category;
  await klass.save();

  res.json({ class: klass });
});

// GET /api/classes?academicYearId= — scoped to one academic year at a time,
// same as the rest of the app. Defaults to the current year so nothing
// changes for teachers or for existing manager flows. Pass a past year's id
// (manager only) to browse that year's classes read-only; pass ?all=true
// (manager only) to skip year-scoping entirely, e.g. for cross-year admin
// views.
const listClasses = asyncHandler(async (req, res) => {
  const wantsAll = req.query.all === "true";
  if (wantsAll && req.user.role !== "manager") {
    throw ApiError.forbidden("Only a school manager can view classes across all academic years");
  }

  const where = { schoolId: req.schoolId };
  if (!wantsAll) {
    let academicYearId = req.query.academicYearId;
    // A teacher may look up a specific past year's classes (read-only —
    // they only ever see their own class in there, and nothing here lets
    // them write). Only the "every year at once" wildcard above stays
    // manager-only.
    if (academicYearId && !["manager", "teacher"].includes(req.user.role)) {
      throw ApiError.forbidden("Only a school manager can view a past academic year");
    }
    if (!academicYearId) {
      const currentYear = await getCurrentAcademicYear(req.schoolId);
      academicYearId = currentYear ? currentYear.id : null;
    }
    // No current year set yet (fresh school) — fall through to an empty list
    // rather than accidentally returning every class ever created.
    where.academicYearId = academicYearId || 0;
  }

  const classes = await Class.findAll({
    where,
    include: [
      { model: User, as: "classTeacher", attributes: ["id", "name", "email"] },
      AcademicYear,
      { model: ClassModule, include: [Module] },
    ],
    order: [["name", "ASC"]],
  });

  // Teachers should never see a suspended class in any picker — managers
  // still see everything, including suspended classes, since they're the
  // ones who manage suspension.
  const visible = req.user.role === "teacher" ? classes.filter((c) => !c.isSuspended) : classes;

  res.json({ classes: visible });
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
  if (req.user.role === "teacher" && klass.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
  }
  res.json({ class: klass });
});

// DELETE /api/classes/:id — only allowed if the class has no students and no
// marks recorded — i.e. it was created by mistake or never actually used.
// This protects against silently destroying real academic records. Once
// confirmed empty, its module list, teacher assignments, and any
// notifications referencing it are cleaned up in the same transaction so
// nothing is left dangling.
const deleteClass = asyncHandler(async (req, res) => {
  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  const [studentCount, markCount] = await Promise.all([
    Student.count({ where: { classId: klass.id } }),
    Mark.count({ where: { classId: klass.id } }),
  ]);

  if (studentCount > 0) {
    throw ApiError.conflict(
      "This class still has students enrolled and can't be deleted. Move or remove them first.",
      "CLASS_NOT_EMPTY"
    );
  }
  if (markCount > 0) {
    throw ApiError.conflict(
      "This class already has marks recorded and can't be deleted, to protect that academic record.",
      "CLASS_NOT_EMPTY"
    );
  }

  await sequelize.transaction(async (t) => {
    await ClassModule.destroy({ where: { classId: klass.id }, transaction: t });
    await TeacherModuleAssignment.destroy({ where: { classId: klass.id }, transaction: t });
    await Notification.destroy({ where: { classId: klass.id }, transaction: t });
    await klass.destroy({ transaction: t });
  });

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "class.deleted",
    description: `Deleted class ${klass.name}`,
    entityType: "class",
    entityId: klass.id,
  });

  res.json({ message: "Class deleted" });
});

// PATCH /api/classes/:id/suspend — suspend or unsuspend a class. Suspending
// never touches any data — it only hides the class from teachers (their
// class picker, marks entry, rosters, reports) until it's unsuspended.
const setClassSuspended = asyncHandler(async (req, res) => {
  const { suspended } = req.body;
  if (typeof suspended !== "boolean") throw ApiError.badRequest("suspended must be true or false");

  const klass = await Class.findOne({ where: { id: req.params.id, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  klass.isSuspended = suspended;
  await klass.save();

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
  await assertCurrentYear(klass.academicYearId, req.schoolId);

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
  await assertCurrentYear(klass.academicYearId, req.schoolId);

  if (teacherId === null || teacherId === undefined) {
    const hadTeacher = klass.classTeacherId;
    klass.classTeacherId = null;
    await klass.save();
    if (hadTeacher) {
      await logActivity({
        userId: req.user.id,
        schoolId: req.schoolId,
        action: "class.teacher_unassigned",
        description: `Removed class teacher from ${klass.name}`,
        entityType: "class",
        entityId: klass.id,
      });
    }
    return res.json({ class: klass });
  }

  const teacher = await User.findOne({
    where: { id: teacherId, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.badRequest("Invalid teacherId for this school");

  klass.classTeacherId = teacherId;
  await klass.save();

  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "class.teacher_assigned",
    description: `Assigned ${teacher.name} as class teacher for ${klass.name}`,
    entityType: "class",
    entityId: klass.id,
  });

  res.json({ class: klass });
});

// GET /api/classes/:id/incomplete-marks?termId= — for the class teacher (or a
// manager) to see, per module taught in this class, how many students still
// don't have a mark recorded for the given term. This is what powers the
// "who hasn't finished recording marks yet" view so a class teacher can send
// a reminder to the responsible subject teacher.
const getIncompleteMarks = asyncHandler(async (req, res) => {
  const { termId } = req.query;
  if (!termId) throw ApiError.badRequest("termId query param is required");

  const klass = await Class.findOne({
    where: { id: req.params.id, schoolId: req.schoolId },
    include: [{ model: ClassModule, include: [Module] }],
  });
  if (!klass) throw ApiError.notFound("Class not found");

  // Teachers may only pull this for a class they're the class teacher of;
  // managers can view any class in their school.
  if (req.user.role === "teacher" && klass.classTeacherId !== req.user.id) {
    throw ApiError.forbidden("You are not the class teacher for this class");
  }
  if (req.user.role === "teacher" && klass.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
  }

  const term = await Term.findOne({ where: { id: termId } });
  if (!term) throw ApiError.badRequest("Invalid termId");

  const totalStudents = await Student.count({ where: { classId: klass.id } });
  const moduleIds = klass.ClassModules.map((cm) => cm.moduleId);

  const [assignments, marks, termStatuses] = await Promise.all([
    moduleIds.length
      ? TeacherModuleAssignment.findAll({
          where: { classId: klass.id, moduleId: moduleIds },
          include: [{ model: User, as: "teacher", attributes: ["id", "name", "email"] }],
        })
      : [],
    moduleIds.length
      ? Mark.findAll({ where: { classId: klass.id, moduleId: moduleIds, termId }, attributes: ["moduleId"] })
      : [],
    moduleIds.length
      ? ClassModuleTermStatus.findAll({ where: { classId: klass.id, moduleId: moduleIds, termId } })
      : [],
  ]);

  const assignmentByModule = Object.fromEntries(assignments.map((a) => [a.moduleId, a]));
  const recordedCountByModule = {};
  marks.forEach((m) => {
    recordedCountByModule[m.moduleId] = (recordedCountByModule[m.moduleId] || 0) + 1;
  });
  // A module the teacher has explicitly disabled for this term isn't
  // expected to have marks — leave it out of the "who hasn't recorded yet"
  // list entirely instead of flagging them for something they opted out of.
  const disabledModuleIds = new Set(
    termStatuses.filter((s) => s.disabled).map((s) => s.moduleId)
  );

  const modules = klass.ClassModules.filter((cm) => !disabledModuleIds.has(cm.moduleId))
    .map((cm) => {
      const assignment = assignmentByModule[cm.moduleId];
      const recordedCount = recordedCountByModule[cm.moduleId] || 0;
      const missingCount = Math.max(totalStudents - recordedCount, 0);
      return {
        moduleId: cm.moduleId,
        moduleTitle: cm.Module.moduleTitle,
        moduleCode: cm.Module.moduleCode,
        teacherId: assignment?.teacher?.id || null,
        teacherName: assignment?.teacher?.name || null,
        teacherEmail: assignment?.teacher?.email || null,
        totalStudents,
        recordedCount,
        missingCount,
        completed: totalStudents > 0 && missingCount === 0,
      };
    }).sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle));

  res.json({ className: klass.name, termName: term.name, termLocked: term.isLocked, totalStudents, modules });
});

module.exports = {
  createClass,
  cloneClass,
  listClasses,
  getClass,
  deleteClass,
  setClassSuspended,
  setClassCategory,
  setClassName,
  setClassModules,
  assignClassTeacher,
  getIncompleteMarks,
};
