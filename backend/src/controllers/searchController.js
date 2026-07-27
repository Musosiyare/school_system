const { Op } = require("sequelize");
const { User, Student, Class, AcademicYear, Module, TeacherModuleAssignment } = require("../models");
const asyncHandler = require("../utils/asyncHandler");

const RESULT_LIMIT = 8;

// GET /api/search?q=... — powers the live header search. Manager-only (same
// audience as the Students/Teachers pages it links back into). Returns a
// handful of matches per type, each already carrying the context (class,
// academic year, modules taught) the dropdown needs — no follow-up request
// once the user picks a result.
//
// Each lookup below is two separate queries (find the matching rows, then
// separately fetch their related classes/assignments) rather than one query
// with several hasMany includes. Sequelize forces a "subquery: true" derived
// table when a query combines `limit` with more than one hasMany include —
// that pattern broke on this MySQL setup, so it's avoided entirely here.
const search = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 1) {
    return res.json({ students: [], teachers: [] });
  }

  const like = `%${q}%`;

  const [students, teachers] = await Promise.all([searchStudents(req.schoolId, like), searchTeachers(req.schoolId, like)]);

  res.json({ students, teachers });
});

async function searchStudents(schoolId, like) {
  const students = await Student.findAll({
    where: {
      schoolId,
      [Op.or]: [
        { firstName: { [Op.like]: like } },
        { lastName: { [Op.like]: like } },
        { admissionNumber: { [Op.like]: like } },
      ],
    },
    attributes: ["id", "firstName", "lastName", "admissionNumber", "status", "classId"],
    limit: RESULT_LIMIT,
    order: [["firstName", "ASC"]],
  });

  const classIds = [...new Set(students.map((s) => s.classId).filter(Boolean))];
  const classes = classIds.length
    ? await Class.findAll({
        where: { id: classIds },
        attributes: ["id", "name"],
        include: [{ model: AcademicYear, attributes: ["id", "name"] }],
      })
    : [];
  const classById = new Map(classes.map((c) => [c.id, c]));

  return students.map((s) => {
    const klass = classById.get(s.classId);
    return {
      id: s.id,
      type: "student",
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      status: s.status,
      classId: s.classId,
      className: klass?.name || null,
      academicYearName: klass?.AcademicYear?.name || null,
    };
  });
}

async function searchTeachers(schoolId, like) {
  const teachers = await User.findAll({
    where: {
      schoolId,
      role: "teacher",
      [Op.or]: [
        { name: { [Op.like]: like } },
        { email: { [Op.like]: like } },
        { phone: { [Op.like]: like } },
      ],
    },
    attributes: ["id", "name", "email", "phone", "status", "disciplineRole"],
    limit: RESULT_LIMIT,
    order: [["name", "ASC"]],
  });

  const teacherIds = teachers.map((t) => t.id);
  if (teacherIds.length === 0) return [];

  const [homerooms, assignments] = await Promise.all([
    Class.findAll({
      where: { classTeacherId: teacherIds },
      attributes: ["id", "name", "classTeacherId"],
      include: [{ model: AcademicYear, attributes: ["id", "name"] }],
    }),
    TeacherModuleAssignment.findAll({
      where: { teacherId: teacherIds },
      attributes: ["teacherId"],
      include: [
        { model: Module, attributes: ["id", "moduleTitle"] },
        { model: Class, attributes: ["id", "name"], include: [{ model: AcademicYear, attributes: ["id", "name"] }] },
      ],
    }),
  ]);

  // classesByTeacher: teacherId -> Map(classId -> { classId, className, academicYearName, isHomeroom, modules })
  const classesByTeacher = new Map();

  function getClassMap(teacherId) {
    if (!classesByTeacher.has(teacherId)) classesByTeacher.set(teacherId, new Map());
    return classesByTeacher.get(teacherId);
  }

  homerooms.forEach((c) => {
    const classMap = getClassMap(c.classTeacherId);
    classMap.set(c.id, {
      classId: c.id,
      className: c.name,
      academicYearName: c.AcademicYear?.name || null,
      isHomeroom: true,
      modules: [],
    });
  });

  assignments.forEach((a) => {
    const c = a.Class;
    if (!c) return;
    const classMap = getClassMap(a.teacherId);
    const existing = classMap.get(c.id) || {
      classId: c.id,
      className: c.name,
      academicYearName: c.AcademicYear?.name || null,
      isHomeroom: false,
      modules: [],
    };
    if (a.Module && !existing.modules.includes(a.Module.moduleTitle)) existing.modules.push(a.Module.moduleTitle);
    classMap.set(c.id, existing);
  });

  return teachers.map((t) => ({
    id: t.id,
    type: "teacher",
    name: t.name,
    email: t.email,
    phone: t.phone,
    status: t.status,
    disciplineRole: t.disciplineRole,
    classes: [...(classesByTeacher.get(t.id)?.values() || [])],
  }));
}

module.exports = { search };
