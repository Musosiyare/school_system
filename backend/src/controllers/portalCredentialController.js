const bcrypt = require("bcryptjs");
const { StudentPortalCredential, Student, Class } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { generatePortalUsername, generatePortalTempPassword } = require("../utils/portalCredentials");
const { encryptTempPassword, decryptTempPassword } = require("../utils/tempCredentials");

/**
 * A `teacher` may only manage portal credentials for the class(es) where
 * they're the class teacher (Class.classTeacherId) — checked on every
 * action here, not just hidden in the frontend, so a subject teacher who
 * merely teaches a module in a class (but isn't its class teacher) can't
 * reach its students' credentials. manager/superuser are unrestricted
 * (still school-scoped by each caller via req.schoolId).
 */
function assertCanManageClass(req, klass) {
  if (req.user.role === "teacher" && klass.classTeacherId !== req.user.id) {
    throw ApiError.forbidden("You're not the class teacher for this class.");
  }
}

/**
 * Issues (or re-issues) one student's portal credential row. Shared by the
 * generate-one endpoint below and by createStudent (studentController.js),
 * which calls this directly right after registering a new student so a
 * portal account exists automatically from day one — no separate "create
 * account" step needed. Not itself a route handler.
 */
async function issueCredential({ student, issuedByUserId }) {
  const tempPassword = generatePortalTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const portalUsername = generatePortalUsername(student.id);

  let credential = await StudentPortalCredential.findOne({ where: { studentId: student.id } });
  if (credential) {
    credential.passwordHash = passwordHash;
    credential.mustChangePassword = true;
    credential.tempPasswordEncrypted = encryptTempPassword(tempPassword);
    credential.tempPasswordSetAt = new Date();
    credential.tempPasswordSetBy = issuedByUserId;
    credential.status = "active";
    credential.tokenVersion += 1; // end any existing session
    await credential.save();
  } else {
    credential = await StudentPortalCredential.create({
      studentId: student.id,
      schoolId: student.schoolId,
      portalUsername,
      passwordHash,
      mustChangePassword: true,
      tempPasswordEncrypted: encryptTempPassword(tempPassword),
      tempPasswordSetAt: new Date(),
      tempPasswordSetBy: issuedByUserId,
    });
  }

  return {
    studentId: student.id,
    studentName: `${student.firstName} ${student.lastName}`,
    admissionNumber: student.admissionNumber,
    portalUsername: credential.portalUsername,
    tempPassword, // shown once, in the response only — never logged
  };
}

// POST /api/students/:studentId/portal-credentials/generate
const generateOne = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.studentId);
  const student = await Student.findOne({ where: { id: studentId, schoolId: req.schoolId } });
  if (!student) throw ApiError.notFound("Student not found");

  const klass = await Class.findByPk(student.classId);
  if (!klass) throw ApiError.notFound("Student not found");
  assertCanManageClass(req, klass);

  const result = await issueCredential({ student, issuedByUserId: req.user.id });
  res.json(result);
});

// POST /api/classes/:classId/portal-credentials/generate — bulk-issues
// credentials for every active student in a class at once.
const generateForClass = asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  assertCanManageClass(req, klass);

  const students = await Student.findAll({ where: { classId, status: "active" }, order: [["firstName", "ASC"]] });
  if (students.length === 0) {
    throw ApiError.badRequest("This class has no active students to generate portal credentials for.");
  }
  const results = [];
  for (const student of students) {
    results.push(await issueCredential({ student, issuedByUserId: req.user.id }));
  }

  res.json({ classId, className: klass.name, count: results.length, credentials: results });
});

// GET /api/classes/:classId/portal-credentials — portal-account status for
// every active student in a class. Never includes passwords (only the
// current temp password is ever recoverable, via peekTempPassword below,
// deliberately one at a time rather than a bulk export of live secrets).
const listForClass = asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  assertCanManageClass(req, klass);

  const students = await Student.findAll({
    where: { classId, status: "active" },
    order: [["firstName", "ASC"]],
    include: [{ model: StudentPortalCredential, required: false }],
  });

  res.json(
    students.map((s) => ({
      studentId: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      hasPortalAccount: !!s.StudentPortalCredential,
      portalUsername: s.StudentPortalCredential?.portalUsername || null,
      status: s.StudentPortalCredential?.status || null,
      mustChangePassword: s.StudentPortalCredential?.mustChangePassword ?? null,
      lastLoginAt: s.StudentPortalCredential?.lastLoginAt || null,
    }))
  );
});

// GET /api/classes/:classId/portal-credentials/printable — everything
// needed for a printable/downloadable credentials list in ONE call: every
// active student's Portal ID plus their temp password wherever it's still
// recoverable (only while mustChangePassword is true — once a student sets
// their own password it's gone for good, by design). Deliberately kept
// separate from listForClass above so a routine "who has an account yet"
// check never triggers N decrypt operations it doesn't need.
const printableListForClass = asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
  if (!klass) throw ApiError.notFound("Class not found");
  assertCanManageClass(req, klass);

  const students = await Student.findAll({
    where: { classId, status: "active" },
    order: [["firstName", "ASC"]],
    include: [{ model: StudentPortalCredential, required: false }],
  });
  if (students.length === 0) {
    throw ApiError.badRequest("This class has no active students to list credentials for.");
  }

  const rows = students.map((s) => {
    const cred = s.StudentPortalCredential;
    let tempPassword = null;
    if (cred?.mustChangePassword && cred?.tempPasswordEncrypted) {
      try {
        tempPassword = decryptTempPassword(cred.tempPasswordEncrypted);
      } catch {
        tempPassword = null;
      }
    }
    return {
      studentId: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      portalUsername: cred?.portalUsername || null,
      status: cred?.status || null,
      tempPassword, // null if no account yet, or the student already changed it
    };
  });

  res.json({ classId, className: klass.name, rows });
});

// GET /api/students/:studentId/portal-credentials/peek — recovers the
// current temp password for one student, e.g. to reprint a login slip.
const peekTempPassword = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.studentId);
  const student = await Student.findOne({ where: { id: studentId, schoolId: req.schoolId } });
  if (!student) throw ApiError.notFound("Student not found");

  const klass = await Class.findByPk(student.classId);
  if (!klass) throw ApiError.notFound("Student not found");
  assertCanManageClass(req, klass);

  const credential = await StudentPortalCredential.findOne({ where: { studentId } });
  if (!credential) throw ApiError.notFound("No portal account for this student yet");
  if (!credential.mustChangePassword || !credential.tempPasswordEncrypted) {
    throw ApiError.conflict(
      "This student has already changed their password — the original temp password can no longer be recovered. Reset it instead.",
      "PASSWORD_ALREADY_CHANGED"
    );
  }

  res.json({
    studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    admissionNumber: student.admissionNumber,
    portalUsername: credential.portalUsername,
    tempPassword: decryptTempPassword(credential.tempPasswordEncrypted),
  });
});

// PATCH /api/students/:studentId/portal-credentials/status — suspends or
// reactivates a student's portal access without touching credentials.
const setStatus = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.studentId);
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    throw ApiError.badRequest("status must be 'active' or 'suspended'", "status");
  }

  const student = await Student.findOne({ where: { id: studentId, schoolId: req.schoolId } });
  if (!student) throw ApiError.notFound("Student not found");

  const klass = await Class.findByPk(student.classId);
  if (!klass) throw ApiError.notFound("Student not found");
  assertCanManageClass(req, klass);

  const credential = await StudentPortalCredential.findOne({ where: { studentId } });
  if (!credential) throw ApiError.notFound("No portal account for this student yet");

  credential.status = status;
  if (status === "suspended") credential.tokenVersion += 1;
  await credential.save();
  res.json({ studentId, status: credential.status });
});

module.exports = {
  issueCredential,
  generateOne,
  generateForClass,
  listForClass,
  printableListForClass,
  peekTempPassword,
  setStatus,
};
