const ExcelJS = require("exceljs");
const { Mark, TeacherModuleAssignment, Term, Module, Student, Class, School, User, ClassModuleTermStatus } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { assertCurrentYear } = require("../utils/academicYear");
const { logActivity } = require("../utils/activityLogger");

async function assertTeacherIsAssigned(userId, role, moduleId, classId) {
  if (role === "manager") return; // manager can view/manage all
  const assignment = await TeacherModuleAssignment.findOne({
    where: { teacherId: userId, moduleId, classId },
  });
  if (!assignment) {
    throw ApiError.forbidden("You are not assigned to teach this module for this class");
  }

  // Defense in depth: even if an old assignment row was never cleaned up,
  // a teacher should never be able to read or write marks for a suspended
  // class. The class picker already hides suspended classes, so this only
  // matters for someone calling the API directly.
  const klass = await Class.findByPk(classId);
  if (klass?.isSuspended) {
    throw ApiError.forbidden("This class has been suspended and is no longer available to teachers");
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
  // An archived year's terms are read-only regardless of the manual lock —
  // this is the actual boundary that keeps a past year from ever being
  // edited after the school has moved on from it.
  await assertCurrentYear(term.academicYearId, schoolId);

  const module = await Module.findOne({ where: { id: moduleId, schoolId } });
  if (!module) throw ApiError.badRequest("Invalid moduleId for this school");

  // A module the manager has deactivated school-wide can't have marks
  // recorded against it in any class or term, until it's reactivated —
  // separate from (and checked before) the per-class-per-term disable
  // below, which only ever affects one class+term at a time.
  if (!module.isActive) {
    throw ApiError.moduleDisabled(
      `${module.moduleTitle} has been deactivated by the manager and can't have marks recorded. Reactivate it first.`
    );
  }

  // If this module has been disabled for this specific class+term (e.g. it
  // was never actually taught/tested this term), marks can't be recorded
  // against it until it's re-enabled — otherwise a score could sit
  // recorded while the report/weighted-average silently ignores it.
  const moduleStatus = await ClassModuleTermStatus.findOne({
    where: { classId, moduleId, termId, disabled: true },
  });
  if (moduleStatus) throw ApiError.moduleDisabled();

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
    // Marks shouldn't be recorded for a student who's been marked
    // inactive — enforced here (not just hidden in the UI) so this also
    // blocks a stale downloaded template or a direct API call.
    if (student.status === "inactive") {
      throw ApiError.badRequest(
        `${student.firstName} ${student.lastName} is marked inactive and can't have marks recorded. Reactivate them first if this is a mistake.`
      );
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

  const [klass, module, term] = await Promise.all([
    Class.findByPk(classId),
    Module.findByPk(moduleId),
    Term.findByPk(termId),
  ]);
  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "marks.recorded",
    description: `Recorded ${entries.length} mark${entries.length > 1 ? "s" : ""} for ${module?.moduleTitle || "a module"} — ${klass?.name || "a class"} (${term?.name || "a term"})`,
    entityType: "class",
    entityId: Number(classId),
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

  // Inactive students shouldn't get a blank row for a teacher to fill in —
  // they're not expected to be marked this term.
  const students = await Student.findAll({ where: { classId, status: "active" }, order: [["firstName", "ASC"]] });
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

  // A template downloaded before a student was marked inactive can still
  // have a leftover score sitting in their row — skip those with a
  // warning instead of failing the whole import, same as any other
  // per-row problem above.
  const activeStudents = await Student.findAll({
    where: { classId: numericClassId, status: "active" },
    attributes: ["id"],
  });
  const activeIds = new Set(activeStudents.map((s) => s.id));
  const validEntries = entries.filter((e) => {
    if (activeIds.has(e.studentId)) return true;
    warnings.push(`Student ID ${e.studentId}: marked inactive, score skipped.`);
    return false;
  });

  if (validEntries.length === 0) {
    throw ApiError.badRequest(
      "No valid scores found for active students in the uploaded file."
    );
  }

  const results = await saveMarkEntries({
    classId: numericClassId,
    moduleId: numericModuleId,
    termId,
    entries: validEntries,
    userId: req.user.id,
    schoolId: req.schoolId,
  });

  const [klass, term] = await Promise.all([Class.findByPk(numericClassId), Term.findByPk(termId)]);
  await logActivity({
    userId: req.user.id,
    schoolId: req.schoolId,
    action: "marks.imported",
    description: `Imported ${results.length} mark${results.length > 1 ? "s" : ""} for ${module?.moduleTitle || "a module"} — ${klass?.name || "a class"} (${term?.name || "a term"})`,
    entityType: "class",
    entityId: numericClassId,
  });

  res.status(201).json({ marks: results, imported: results.length, warnings });
});

// Shared by both the PDF and Excel marksheet exports below, so a query
// param check, the "who's the teacher" lookup, and the row-shaping logic
// can't drift between the two formats.
async function loadMarksEvidenceData(req) {
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

  // This is the official evidence marksheet (PDF/Excel export), so it
  // should list the same set of students who were actually expected to be
  // marked — active ones.
  const students = await Student.findAll({ where: { classId, status: "active" }, order: [["firstName", "ASC"]] });
  const marks = await Mark.findAll({ where: { classId, moduleId, termId } });
  const scoreByStudent = Object.fromEntries(marks.map((m) => [m.studentId, m.score]));

  const rows = students.map((s) => ({
    studentName: `${s.firstName} ${s.lastName}`,
    admissionNumber: s.admissionNumber,
    score: scoreByStudent[s.id] ?? null,
  }));

  return { classId, moduleId, termId, klass, module, term, school, teacherName, rows };
}

// GET /api/marks/evidence/excel?classId=&moduleId=&termId= — the marksheet
// as an .xlsx, styled to match the class roster export (teal header banner,
// plain white bordered rows) so a teacher can reopen, sort, or paste it
// elsewhere. Refuses to generate a sheet with nothing recorded on it yet.
const getMarksEvidenceExcel = asyncHandler(async (req, res) => {
  const { classId, moduleId, termId, klass, module, term, school, teacherName, rows } =
    await loadMarksEvidenceData(req);

  const recordedCount = rows.filter((r) => r.score !== null).length;
  if (recordedCount === 0) {
    throw ApiError.badRequest(
      "No marks have been recorded yet for this module/class/term — there's nothing to put on a marksheet."
    );
  }
  const passCount = rows.filter((r) => r.score !== null && r.score >= module.passingLine).length;
  const average =
    recordedCount > 0
      ? +(rows.reduce((sum, r) => sum + (r.score ?? 0), 0) / recordedCount).toFixed(2)
      : null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = school?.name || "EduManage Pro";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Marksheet", {
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  const TEAL_DARK = "FF0F766E";
  const BORDER = { style: "thin", color: { argb: "FFCBD5E1" } };
  const GREEN = "FF1F7A4D";
  const RED = "FFB3403A";
  const BLUE = "FF1D4ED8";

  sheet.columns = [
    { width: 6 }, // #
    { width: 30 }, // Student
    { width: 20 }, // Admission No.
    { width: 16 }, // Score
    { width: 18 }, // Status
  ];

  // --- Header block ---
  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = school?.name || "EduManage Pro";
  titleCell.font = { bold: true, size: 15, color: { argb: TEAL_DARK } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells("A2:E2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `Marks Evidence Report — ${module.moduleTitle}${
    module.moduleCode ? ` (${module.moduleCode})` : ""
  } · ${klass.name} · ${term.name}`;
  subtitleCell.font = { italic: true, size: 11, color: { argb: "FF475569" } };

  sheet.getCell("A3").value = "Teacher:";
  sheet.getCell("A3").font = { bold: true, size: 10 };
  sheet.mergeCells("B3:E3");
  sheet.getCell("B3").value = teacherName;
  sheet.getCell("B3").font = { size: 10 };

  sheet.getCell("A4").value = "Generated:";
  sheet.getCell("A4").font = { bold: true, size: 10 };
  sheet.mergeCells("B4:E4");
  sheet.getCell("B4").value = new Date().toLocaleDateString();
  sheet.getCell("B4").font = { size: 10 };

  // Headline recorded/average/passing banner, in the same teal used for the
  // table header — the only place color shows up outside the header row.
  sheet.mergeCells("A5:E5");
  const summaryCell = sheet.getCell("A5");
  summaryCell.value = `Recorded: ${recordedCount} / ${rows.length}   |   Class Average: ${
    average !== null ? `${average} / ${module.maxScore}` : "—"
  }   |   Passing: ${recordedCount > 0 ? `${passCount} / ${recordedCount}` : "—"}`;
  summaryCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  summaryCell.alignment = { vertical: "middle", horizontal: "left" };
  summaryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_DARK } };
  sheet.getRow(5).height = 22;

  sheet.getRow(6).height = 6; // spacer

  // --- Table header (row 8, matching the frozen split above) ---
  const headerRow = sheet.getRow(8);
  headerRow.values = ["#", "Student", "Admission No.", `Score (0-${module.maxScore})`, "Status"];
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_DARK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });

  // Data rows stay plain white — color is reserved for the header/banner so
  // the marksheet itself stays easy to read and print, with only the status
  // text (not its cell background) picking up green/red/blue.
  const firstDataRow = 9;
  rows.forEach((r, idx) => {
    const rowNum = firstDataRow + idx;
    const row = sheet.getRow(rowNum);
    const statusText = r.score === null ? "NOT RECORDED" : r.score >= module.passingLine ? "PASS" : "FAIL";
    const statusColor = r.score === null ? BLUE : r.score >= module.passingLine ? GREEN : RED;
    row.values = [
      idx + 1,
      r.studentName,
      r.admissionNumber || "-",
      r.score === null ? "N/A" : `${r.score} / ${module.maxScore}`,
      statusText,
    ];
    row.eachCell((cell, colNumber) => {
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center" };
      if (colNumber === 5) cell.font = { bold: true, color: { argb: statusColor } };
    });
  });

  if (rows.length === 0) {
    sheet.mergeCells(`A${firstDataRow}:E${firstDataRow}`);
    const emptyCell = sheet.getCell(`A${firstDataRow}`);
    emptyCell.value = "No students in this class yet.";
    emptyCell.font = { italic: true, size: 10, color: { argb: "FF94A3B8" } };
    emptyCell.alignment = { horizontal: "center" };
  } else {
    sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: 5 } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeModule = module.moduleTitle.replace(/[^a-z0-9]+/gi, "-");
  const safeClass = klass.name.replace(/[^a-z0-9]+/gi, "-");
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="marksheet-${safeClass}-${safeModule}-term${termId}.xlsx"`,
  });
  res.send(Buffer.from(buffer));
});

module.exports = {
  submitMarks,
  getMarks,
  getMarksEvidenceExcel,
  downloadMarksTemplate,
  importMarksTemplate,
};
