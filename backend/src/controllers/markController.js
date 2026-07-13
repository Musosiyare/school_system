const ExcelJS = require("exceljs");
const { Mark, TeacherModuleAssignment, Term, Module, Student, Class, School, User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { generateMarksEvidencePdf } = require("../services/pdfService");

async function assertTeacherIsAssigned(userId, role, moduleId, classId) {
  if (role === "manager") return; // manager can view/manage all
  const assignment = await TeacherModuleAssignment.findOne({
    where: { teacherId: userId, moduleId, classId },
  });
  if (!assignment) {
    throw ApiError.forbidden("You are not assigned to teach this module for this class");
  }
}

// Shared by submitMarks (JSON entry) and importMarksTemplate (spreadsheet
// upload) — both end up with the same {studentId, score} shape and need
// the same validation + upsert behaviour, so the actual writing only
// lives in one place.
async function saveMarkEntries({ classId, moduleId, termId, entries, userId, schoolId }) {
  const term = await Term.findByPk(termId);
  if (!term) throw ApiError.badRequest("Invalid termId");
  if (term.isLocked) throw ApiError.termLocked();

  const module = await Module.findOne({ where: { id: moduleId, schoolId } });
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");

  // Validate every entry before writing anything (FR-4.3)
  entries.forEach((e, idx) => {
    if (typeof e.studentId !== "number") {
      throw ApiError.badRequest(`entries[${idx}].studentId is required`, `entries[${idx}].studentId`);
    }
    if (typeof e.score !== "number" || e.score < 0 || e.score > module.maxScore) {
      throw ApiError.badRequest(
        `Score must be between 0 and ${module.maxScore} for this module`,
        `entries[${idx}].score`
      );
    }
  });

  const results = [];
  for (const entry of entries) {
    const student = await Student.findOne({ where: { id: entry.studentId, classId } });
    if (!student) {
      throw ApiError.badRequest(`Student ${entry.studentId} is not in this class`);
    }

    const [mark] = await Mark.findOrCreate({
      where: { studentId: entry.studentId, moduleId, termId },
      defaults: { classId, score: entry.score, recordedBy: userId },
    });

    if (mark.score !== entry.score) {
      mark.score = entry.score;
      mark.recordedBy = userId;
      await mark.save();
    }
    results.push(mark);
  }

  return results;
}

// POST /api/marks — bulk create/update marks for a class+module+term (FR-4.1, FR-4.2, FR-4.5)
const submitMarks = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId, entries } = req.body;

  if (!classId || !moduleId || !termId || !Array.isArray(entries) || entries.length === 0) {
    throw ApiError.badRequest("classId, moduleId, termId and a non-empty entries array are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, moduleId, classId);

  const results = await saveMarkEntries({
    classId,
    moduleId,
    termId,
    entries,
    userId: req.user.id,
    schoolId: req.schoolId,
  });

  res.status(201).json({ marks: results });
});

// GET /api/marks?classId=&moduleId=&termId=
const getMarks = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId query params are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));

  const marks = await Mark.findAll({
    where: { classId, moduleId, termId },
    include: [Student],
  });

  res.json({ marks });
});

// Shared lookup for the template download/import endpoints — pulls the
// class/module/term/school combo and checks it belongs to this school.
async function loadMarksContext({ classId, moduleId, termId, schoolId }) {
  const [klass, module, term, school] = await Promise.all([
    Class.findOne({ where: { id: classId, schoolId } }),
    Module.findOne({ where: { id: moduleId, schoolId } }),
    Term.findByPk(termId),
    School.findByPk(schoolId),
  ]);
  if (!klass) throw ApiError.badRequest("Invalid classId for this school");
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");
  if (!term) throw ApiError.badRequest("Invalid termId");
  return { klass, module, term, school };
}

// The fixed row/column layout shared by both the template generator and the
// importer, so a change to one place can't silently drift from the other.
const TEMPLATE_FIRST_DATA_ROW = 8;
const TEMPLATE_COLS = { studentId: 1, admissionNumber: 2, firstName: 3, lastName: 4, score: 5 };

// GET /api/marks/template?classId=&moduleId=&termId= — a fill-in-the-blanks
// spreadsheet a teacher can take offline (or hand to someone else) and bring
// back with importMarksTemplate below. Score cells are the only unlocked
// (editable) cells once the sheet is protected, so the roster itself can't
// accidentally be altered.
const downloadMarksTemplate = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId query params are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));
  const { klass, module, term, school } = await loadMarksContext({
    classId,
    moduleId,
    termId,
    schoolId: req.schoolId,
  });

  const students = await Student.findAll({ where: { classId }, order: [["firstName", "ASC"]] });
  const marks = await Mark.findAll({ where: { classId, moduleId, termId } });
  const scoreByStudent = Object.fromEntries(marks.map((m) => [m.studentId, m.score]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = school?.name || "EduManage Pro";
  const sheet = workbook.addWorksheet("Marks", {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  sheet.columns = [
    { width: 12 }, // Student ID (hidden, used for matching on import)
    { width: 18 }, // Admission Number
    { width: 20 }, // First Name
    { width: 20 }, // Last Name
    { width: 16 }, // Score
  ];
  sheet.getColumn(TEMPLATE_COLS.studentId).hidden = true;

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = `${school?.name || ""} — Marks Recording Template`;
  sheet.getCell("A1").font = { bold: true, size: 13 };

  const infoRows = [
    ["Module:", `${module.moduleTitle} (${module.moduleCode})`],
    ["Class:", klass.name],
    ["Term:", term.name],
    ["Max Score:", module.maxScore],
  ];
  infoRows.forEach(([label, value], idx) => {
    const rowNum = idx + 2;
    sheet.getCell(`A${rowNum}`).value = label;
    sheet.getCell(`A${rowNum}`).font = { bold: true };
    sheet.mergeCells(`B${rowNum}:E${rowNum}`);
    sheet.getCell(`B${rowNum}`).value = value;
  });

  const headerRow = sheet.getRow(7);
  headerRow.values = ["Student ID", "Admission Number", "First Name", "Last Name", `Score (0-${module.maxScore})`];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  students.forEach((s, idx) => {
    const rowNum = TEMPLATE_FIRST_DATA_ROW + idx;
    const row = sheet.getRow(rowNum);
    row.getCell(TEMPLATE_COLS.studentId).value = s.id;
    row.getCell(TEMPLATE_COLS.admissionNumber).value = s.admissionNumber || "";
    row.getCell(TEMPLATE_COLS.firstName).value = s.firstName;
    row.getCell(TEMPLATE_COLS.lastName).value = s.lastName;
    const existingScore = scoreByStudent[s.id];
    const scoreCell = row.getCell(TEMPLATE_COLS.score);
    scoreCell.value = existingScore !== undefined ? existingScore : null;
    scoreCell.dataValidation = {
      type: "decimal",
      operator: "between",
      formulae: [0, module.maxScore],
      showErrorMessage: true,
      errorTitle: "Invalid score",
      error: `Score must be a number between 0 and ${module.maxScore}.`,
    };
    // Only the score column stays editable once the sheet is protected below.
    scoreCell.protection = { locked: false };
    [TEMPLATE_COLS.admissionNumber, TEMPLATE_COLS.firstName, TEMPLATE_COLS.lastName].forEach((col) => {
      row.getCell(col).protection = { locked: true };
    });
    row.getCell(TEMPLATE_COLS.studentId).protection = { locked: true };
  });

  const noteRow = TEMPLATE_FIRST_DATA_ROW + students.length + 1;
  sheet.mergeCells(`A${noteRow}:E${noteRow}`);
  sheet.getCell(`A${noteRow}`).value =
    "Only edit the Score column. Do not add, remove, or reorder rows, and do not edit the Student ID column — doing so may cause the upload to be rejected.";
  sheet.getCell(`A${noteRow}`).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  sheet.getCell(`A${noteRow}`).alignment = { wrapText: true };

  // No password — this is a guardrail against accidental edits, not a
  // security boundary, so teachers using older Excel/LibreOffice builds
  // aren't locked out if they need to override something.
  await sheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeModule = module.moduleTitle.replace(/[^a-z0-9]+/gi, "-");
  const safeClass = klass.name.replace(/[^a-z0-9]+/gi, "-");
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="marks-template-${safeClass}-${safeModule}-term${termId}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
});

// POST /api/marks/import — multipart upload of a filled-in template
// produced by downloadMarksTemplate. Reuses saveMarkEntries so the result
// is identical to entering the same scores by hand and clicking Save.
const importMarksTemplate = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.body;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId are required");
  }
  if (!req.file) {
    throw ApiError.badRequest("No file uploaded. Attach the filled-in template as 'file'.");
  }

  const numericClassId = Number(classId);
  const numericModuleId = Number(moduleId);

  await assertTeacherIsAssigned(req.user.id, req.user.role, numericModuleId, numericClassId);
  const { module } = await loadMarksContext({
    classId: numericClassId,
    moduleId: numericModuleId,
    termId,
    schoolId: req.schoolId,
  });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer);
  } catch (err) {
    throw ApiError.badRequest("Could not read this file. Please upload the .xlsx template unmodified in format.");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw ApiError.badRequest("The uploaded file has no sheets.");
  }

  const entries = [];
  const warnings = [];
  let rowNum = TEMPLATE_FIRST_DATA_ROW;
  // Walk rows until we hit one with no Student ID — that's the end of the
  // roster (matches how downloadMarksTemplate lays rows out contiguously).
  while (true) {
    const row = sheet.getRow(rowNum);
    const studentIdRaw = row.getCell(TEMPLATE_COLS.studentId).value;
    if (studentIdRaw === null || studentIdRaw === undefined || studentIdRaw === "") break;

    const studentId = Number(studentIdRaw);
    const scoreCell = row.getCell(TEMPLATE_COLS.score);
    let scoreRaw = scoreCell.value;
    // ExcelJS can hand back a {result} object for formula cells — fall back
    // to that if a teacher accidentally left a formula in the cell.
    if (scoreRaw && typeof scoreRaw === "object" && "result" in scoreRaw) {
      scoreRaw = scoreRaw.result;
    }

    if (scoreRaw === null || scoreRaw === undefined || scoreRaw === "") {
      rowNum += 1;
      continue; // blank score = not recorded for this student yet, skip silently
    }

    const score = Number(scoreRaw);
    if (Number.isNaN(studentId) || Number.isNaN(score)) {
      warnings.push(`Row ${rowNum}: could not read a valid score, skipped.`);
      rowNum += 1;
      continue;
    }
    if (score < 0 || score > module.maxScore) {
      warnings.push(`Row ${rowNum}: score ${score} is outside 0-${module.maxScore}, skipped.`);
      rowNum += 1;
      continue;
    }

    entries.push({ studentId, score });
    rowNum += 1;
  }

  if (entries.length === 0) {
    throw ApiError.badRequest(
      "No valid scores found in the uploaded file. Make sure the Score column is filled in and the file is the unmodified template."
    );
  }

  const results = await saveMarkEntries({
    classId: numericClassId,
    moduleId: numericModuleId,
    termId,
    entries,
    userId: req.user.id,
    schoolId: req.schoolId,
  });

  res.status(201).json({ marks: results, imported: results.length, warnings });
});

// GET /api/marks/evidence/pdf?classId=&moduleId=&termId= — a teacher's proof
// of what they recorded for a module/class/term. Lists every student in the
// class (not just those with a score), so gaps are visible as evidence too.
const getMarksEvidencePdf = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId || !termId) {
    throw ApiError.badRequest("classId, moduleId and termId query params are required");
  }

  await assertTeacherIsAssigned(req.user.id, req.user.role, Number(moduleId), Number(classId));

  const { klass, module, term, school } = await loadMarksContext({
    classId,
    moduleId,
    termId,
    schoolId: req.schoolId,
  });

  // Whoever's assignment this is — for a teacher that's themselves; a
  // manager pulling this for oversight sees the actual assigned teacher.
  let teacherName;
  if (req.user.role === "manager") {
    const assignment = await TeacherModuleAssignment.findOne({
      where: { moduleId, classId },
      include: [{ model: User, as: "teacher", attributes: ["name"] }],
    });
    teacherName = assignment?.teacher?.name || "Unassigned";
  } else {
    const requester = await User.findByPk(req.user.id, { attributes: ["name"] });
    teacherName = requester?.name || "Unknown";
  }

  const students = await Student.findAll({ where: { classId }, order: [["firstName", "ASC"]] });
  const marks = await Mark.findAll({ where: { classId, moduleId, termId } });
  const scoreByStudent = Object.fromEntries(marks.map((m) => [m.studentId, m.score]));

  const rows = students.map((s) => ({
    studentName: `${s.firstName} ${s.lastName}`,
    admissionNumber: s.admissionNumber,
    score: scoreByStudent[s.id] ?? null,
  }));

  const pdfBuffer = await generateMarksEvidencePdf(
    {
      moduleTitle: module.moduleTitle,
      moduleCode: module.moduleCode,
      className: klass.name,
      termName: term.name,
      teacherName,
      maxScore: module.maxScore,
      passingLine: module.passingLine,
      rows,
      generatedAt: new Date().toLocaleDateString(),
    },
    school.name
  );

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="marks-evidence-class${classId}-module${moduleId}-term${termId}.pdf"`,
  });
  res.send(pdfBuffer);
});

module.exports = {
  submitMarks,
  getMarks,
  getMarksEvidencePdf,
  downloadMarksTemplate,
  importMarksTemplate,
};
