const { TeacherModuleAssignment, User, Module, Class, ClassModule } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/assignments — assign a subject teacher to a module for a class (FR-2.5)
const createAssignment = asyncHandler(async (req, res) => {
  const { teacherId, moduleId, classId } = req.body;
  if (!teacherId || !moduleId || !classId) {
    throw ApiError.badRequest("teacherId, moduleId and classId are required");
  }

  const teacher = await User.findOne({
    where: { id: teacherId, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.badRequest("Invalid teacherId for this school");
  if (teacher.status !== "active") {
    throw ApiError.badRequest("This teacher has been deactivated and can't be assigned new modules");
  }

  const module = await Module.findOne({ where: { id: moduleId, schoolId: req.schoolId } });
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");

  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.badRequest("Invalid classId for this school");

  // The academic year is a property of the class, not something a manager
  // should have to pick a second time by hand (it can only ever be the
  // class's own year, and asking for it separately just invites mismatches).
  const academicYearId = klass.academicYearId;

  const existing = await TeacherModuleAssignment.findOne({
    where: { teacherId, moduleId, classId, academicYearId },
  });
  if (existing) throw ApiError.conflict("This assignment already exists");

  const assignment = await TeacherModuleAssignment.create({
    teacherId,
    moduleId,
    classId,
    academicYearId,
  });

  // A module a teacher is assigned to teach for this class must show up on
  // that class's reports, regardless of who the class teacher is — reports
  // are built from ClassModule (the class's module list), not from who
  // teaches what. Without this, a module only appeared on reports if it had
  // separately been added to the class via the Classes "Manage" screen, so
  // subject teachers' modules could silently go missing from report cards.
  await ClassModule.findOrCreate({ where: { classId, moduleId } });

  res.status(201).json({ assignment });
});

// GET /api/teachers/:id/assignments — a teacher's own modules/classes (FR-3.2)
const listTeacherAssignments = asyncHandler(async (req, res) => {
  const teacherId = req.params.id;

  // Teachers may only view their own assignments; managers can view any within their school
  if (req.user.role === "teacher" && String(req.user.id) !== String(teacherId)) {
    throw ApiError.forbidden("You can only view your own assignments");
  }

  const assignments = await TeacherModuleAssignment.findAll({
    where: { teacherId },
    include: [Module, Class],
  });

  res.json({ assignments });
});

// GET /api/assignments — all assignments in the manager's school (for the overview table)
const listAllAssignments = asyncHandler(async (req, res) => {
  const assignments = await TeacherModuleAssignment.findAll({
    include: [
      { model: User, as: "teacher", attributes: ["id", "name", "email"] },
      Module,
      { model: Class, where: { schoolId: req.schoolId } },
    ],
    order: [["id", "DESC"]],
  });
  res.json({ assignments });
});

// DELETE /api/assignments/:id — remove an assignment
const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await TeacherModuleAssignment.findByPk(req.params.id, { include: [Class] });
  if (!assignment || assignment.Class.schoolId !== req.schoolId) {
    throw ApiError.notFound("Assignment not found");
  }
  await assignment.destroy();
  res.json({ message: "Assignment removed" });
});

// PATCH /api/assignments/:id — reassign an existing assignment to a different
// teacher, keeping the same module/class/year. Lets a manager fix a mistake
// in one step instead of deleting and recreating the assignment.
const updateAssignment = asyncHandler(async (req, res) => {
  const { teacherId } = req.body;
  if (!teacherId) throw ApiError.badRequest("teacherId is required");

  const assignment = await TeacherModuleAssignment.findByPk(req.params.id, { include: [Class] });
  if (!assignment || assignment.Class.schoolId !== req.schoolId) {
    throw ApiError.notFound("Assignment not found");
  }

  const teacher = await User.findOne({
    where: { id: teacherId, schoolId: req.schoolId, role: "teacher" },
  });
  if (!teacher) throw ApiError.badRequest("Invalid teacherId for this school");
  if (teacher.status !== "active") {
    throw ApiError.badRequest("This teacher has been deactivated and can't be assigned new modules");
  }

  const duplicate = await TeacherModuleAssignment.findOne({
    where: {
      teacherId,
      moduleId: assignment.moduleId,
      classId: assignment.classId,
      academicYearId: assignment.academicYearId,
    },
  });
  if (duplicate && duplicate.id !== assignment.id) {
    throw ApiError.conflict("That teacher is already assigned to this module in this class");
  }

  assignment.teacherId = teacherId;
  await assignment.save();

  res.json({ assignment });
});

module.exports = {
  createAssignment,
  listTeacherAssignments,
  listAllAssignments,
  deleteAssignment,
  updateAssignment,
};
