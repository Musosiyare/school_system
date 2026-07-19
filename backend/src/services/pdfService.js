const PdfPrinter = require("pdfmake");

// Use pdfkit's built-in standard fonts (no external .ttf files to manage/ship).
// If custom branding fonts are needed later, swap these for file paths to .ttf files.
const fonts = {
  Roboto: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};
const printer = new PdfPrinter(fonts);

const BLACK = "#000000";
const WHITE = "#ffffff";
// Report card is intentionally black-and-white only (no fills, no colored
// text) so it always prints correctly on B&W printers. These names are kept
// so the section-building functions below don't need renaming.
const BRAND_BLUE = "#000000";
const BRAND_BLUE_LIGHT = "#ffffff";
const PANEL_GREY = "#ffffff";
const BORDER_GREY = "#000000";
// Used only for the "MID-TERM REPORT CARD" / term heading — the one spot on
// the report card that's intentionally colored (navy blue, bold). Everything
// else on the card stays black-and-white so it still prints cleanly on B&W
// printers.
const TITLE_COLOR = "#0a2f5c";
// Used only for the "ACADEMIC PERFORMANCE" section label (navy blue, bold) —
// same navy blue as TITLE_COLOR. Other section labels (e.g. SIGNATURES) stay
// black via sectionLabel()'s default.
const SECTION_TITLE_COLOR = "#0a2f5c";

// Every section below uses this same layout: solid black grid lines, no
// fills, no color — a plain black-and-white bordered table.
const blackGridLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => BLACK,
  vLineColor: () => BLACK,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

// No border at all — used by every section except the Academic Performance
// table and the single outer border wrapping the whole report card.
const plainLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

// A short blue bar used as a section label (mirrors the light-blue
// "Academic Performance" / "Comments and Summary" / "Signatures" strips in
// the template).
function sectionLabel(text, color, fontSize) {
  return {
    table: {
      widths: ["*"],
      body: [[{ text, bold: true, fontSize: fontSize || 10, color: color || BRAND_BLUE }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => BRAND_BLUE_LIGHT,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    margin: [0, 10, 0, 8],
  };
}

// PASS/FAIL displayed using competency-based terminology, same mapping the
// frontend applies (toDecision in Reports.jsx), so the PDF and the on-screen
// report agree.
function toDecision(word) {
  if (word === "PASS") return "C";
  if (word === "FAIL") return "NYC";
  if (word === "NOT RECORDED") return "N/A";
  return word;
}

// "specific" -> "Specific", used for the module Type column on the report.
function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Overall Result is graded off the weighted average itself, not the plain
// PASS/FAIL flag: Excellent 80-100, Very Good 70-79, Pass 50-69, else Fail.
function overallGrade(weightedAverage) {
  if (weightedAverage === null || weightedAverage === undefined) return "N/A";
  if (weightedAverage >= 80) return "EXCELLENT";
  if (weightedAverage >= 70) return "VERY GOOD";
  if (weightedAverage >= 50) return "PASS";
  return "FAIL";
}

// Each Overall Result grade gets its own color so it stands out at a
// glance — same mapping the frontend applies (overallGradeColor in
// Reports.jsx), so the PDF and the on-screen report agree.
function overallGradeColor(weightedAverage) {
  const grade = overallGrade(weightedAverage);
  if (grade === "EXCELLENT") return "#1f7a4d"; // green
  if (grade === "VERY GOOD") return "#1d4ed8"; // blue
  if (grade === "PASS") return "#b45309"; // amber
  if (grade === "FAIL") return "#b3403a"; // red
  return "#6b7280"; // N/A — gray
}

// ---------- Banner: centered title/term on top, then a two-column row
// below — school name/location on the left, labeled student details
// (Student Name / Class / Student ID) on the right. Every line in the
// banner — title, term, school, student fields — uses the same font
// size so nothing is visually "bigger" than anything else. ----------
const HEADER_FONT_SIZE = 12;
// The "MID-TERM REPORT CARD" title itself is intentionally bigger than the
// rest of the banner (term, school name, student fields) so it stands out
// as the page heading. The term line underneath it is bumped slightly too.
const TITLE_FONT_SIZE = 16;
const TERM_FONT_SIZE = 13;

// Appends the class's education track — TSS (Technical Secondary School) or
// GE (General Education) — next to its name, e.g. "S1A (TSS)". Falls back
// to just the class name if no category is known (e.g. older records).
function classLabel(className, classCategory) {
  const name = className || "-";
  if (classCategory !== "TSS" && classCategory !== "GE") return name;
  return `${name} (${classCategory})`;
}

// Full track name shown ahead of the report card title, e.g.
// "TECHNICAL SECONDARY SCHOOL / MID-TERM REPORT CARD". Omitted entirely
// when the category isn't known.
function categoryFullName(classCategory) {
  if (classCategory === "TSS") return "TECHNICAL SECONDARY SCHOOL";
  if (classCategory === "GE") return "GENERAL EDUCATION";
  return null;
}

function reportCardTitle(classCategory) {
  const prefix = categoryFullName(classCategory);
  return prefix ? `${prefix} / MID-TERM REPORT CARD` : "MID-TERM REPORT CARD";
}

function letterhead(schoolName, schoolAddress, termName, admissionNumber, report, className, schoolEmail, schoolPhone, classCategory) {
  const contactLine = [schoolPhone, schoolEmail].filter(Boolean).join("  ·  ");
  return {
    stack: [
      { text: reportCardTitle(classCategory ?? report.student?.classCategory), bold: true, fontSize: TITLE_FONT_SIZE, color: TITLE_COLOR, alignment: "center" },
      {
        text: report.academicYear ? `${termName || "-"} \u2014 ${report.academicYear}` : termName || "-",
        bold: true,
        fontSize: TERM_FONT_SIZE,
        color: TITLE_COLOR,
        alignment: "center",
        margin: [0, 2, 0, 8],
      },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              {
                stack: [
                  {
                    svg: '<svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" fill="#0a1f44"/></svg>',
                    width: 40,
                    margin: [0, 0, 0, 4],
                  },
                  { text: schoolName || "School", bold: true, fontSize: HEADER_FONT_SIZE, color: BLACK },
                  {
                    text: schoolAddress || "",
                    bold: true,
                    fontSize: HEADER_FONT_SIZE,
                    color: BLACK,
                    margin: [0, 2, 0, 0],
                  },
                  contactLine
                    ? {
                        text: contactLine,
                        fontSize: 9,
                        color: BLACK,
                        margin: [0, 2, 0, 0],
                      }
                    : null,
                ].filter(Boolean),
                alignment: "left",
              },
              {
                stack: [
                  {
                    text: `Student Name: ${report.student?.name || "-"}`,
                    bold: true,
                    fontSize: HEADER_FONT_SIZE,
                    color: BLACK,
                    alignment: "right",
                  },
                  {
                    text: `Class: ${classLabel(className || report.student?.class, classCategory ?? report.student?.classCategory)}`,
                    bold: true,
                    fontSize: HEADER_FONT_SIZE,
                    color: BLACK,
                    alignment: "right",
                    margin: [0, 2, 0, 0],
                  },
                  {
                    text: `Student ID: ${admissionNumber || "-"}`,
                    bold: true,
                    fontSize: HEADER_FONT_SIZE,
                    color: BLACK,
                    alignment: "right",
                    margin: [0, 2, 0, 0],
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        },
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

// ---------- Module performance table (the template's "Academic
// Performance" grid, using our real modules instead of generic subjects).
// Kept strictly black-and-white — plain black grid lines, no color fills —
// since this is the official scored data on the report. ----------
// Same plain black grid as blackGridLayout, but with tighter left/right
// padding — used only for the Academic Performance table, where several
// columns (Module Code, Decision) are narrow and need the extra room more
// than they need whitespace.
const moduleTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => BLACK,
  vLineColor: () => BLACK,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

function moduleTable(modules) {
  const headerCell = (text, alignment) => ({
    text,
    bold: true,
    fontSize: 9,
    alignment: alignment || "left",
  });
  const body = [
    [
      headerCell("Module Type", "center"),
      headerCell("Module Code"),
      headerCell("Module Name"),
      headerCell("Weight/Marks", "center"),
      headerCell("Score", "center"),
      headerCell("Decision", "center"),
    ],
  ];

  if (modules.length === 0) {
    body.push([{ text: "No modules assigned to this class.", colSpan: 6, alignment: "center" }, {}, {}, {}, {}, {}]);
  }

  // Modules arrive pre-grouped by type (specific, then general, then
  // complementary) from reportService, so a run of same-type modules is
  // always contiguous — that's what lets rowSpan merge them into one
  // "Module Type" cell per group instead of repeating it on every row.
  const typeGroupSizes = {};
  modules.forEach((m) => {
    const t = m.type || "general";
    typeGroupSizes[t] = (typeGroupSizes[t] || 0) + 1;
  });
  const seenTypes = {};

  modules.forEach((m) => {
    const t = m.type || "general";
    const isFirstOfGroup = !seenTypes[t];
    seenTypes[t] = true;

    const passPct = t === "specific" ? 70 : 50;
    const typeCell = isFirstOfGroup
      ? {
          stack: [
            { text: capitalize(t), bold: true, fontSize: 9 },
            { text: `Passing line ${passPct}%`, fontSize: 7.5, color: "#444444", margin: [0, 1, 0, 0] },
          ],
          rowSpan: typeGroupSizes[t],
          alignment: "center",
        }
      : {};

    body.push([
      typeCell,
      { text: m.code || "-", bold: true, fontSize: 8.5, noWrap: true },
      { text: m.title, fontSize: 9 },
      { text: String(m.weight), alignment: "center", fontSize: 9, bold: true },
      { text: m.score === null ? "N/A" : String(m.score), alignment: "center", fontSize: 9 },
      { text: toDecision(m.status), alignment: "center", bold: true, fontSize: 9 },
    ]);
  });

  const totalWeight = modules.reduce((sum, m) => sum + (m.weight || 0), 0);
  const totalScore = modules.reduce((sum, m) => sum + (m.score || 0), 0);
  body.push([
    { text: "TOTAL", bold: true, colSpan: 3, alignment: "right", fontSize: 9 }, {}, {},
    { text: String(totalWeight), bold: true, alignment: "center", fontSize: 9 },
    { text: String(totalScore), bold: true, alignment: "center", fontSize: 9 },
    { text: "", alignment: "center" },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: [60, 60, "*", 50, 34, 40],
      // dontBreakRows keeps every row intact — a row can't be split across a
      // page boundary, which is the usual cause of a report looking
      // "collapsed" when printed.
      dontBreakRows: true,
      body,
    },
    layout: moduleTableLayout,
    margin: [0, 0, 0, 4],
  };
}

// ---------- Small note explaining N/A to students/parents reading the
// printed card — only shown when at least one module has no recorded mark
// yet, so it doesn't take up space on a fully-scored report. ----------
function naNote(modules) {
  if (!modules.some((m) => m.score === null)) return null;
  return {
    text: "N/A = mark not yet recorded for that module. It does not count against the student and has no effect on the weighted average or overall result below.",
    italics: true,
    fontSize: 6.5,
    color: BLACK,
    margin: [0, 0, 0, 4],
  };
}

// ---------- Summary strip: Weighted Average / Overall Result / Class Rank
// side by side in one bordered row. Class Rank reads "X out of Y" — X is
// this student's position, Y is how many students in the class were
// actually rankable (i.e. have at least one recorded mark) this term. ----------
function summaryStrip(report) {
  const rankText =
    report.classRank !== undefined && report.classRank !== null && report.classRankTotal
      ? `${report.classRank} out of ${report.classRankTotal}`
      : "N/A";
  return {
    table: {
      widths: ["*", "*", "*"],
      dontBreakRows: true,
      body: [
        [
          { text: "WEIGHTED AVERAGE", bold: true, fontSize: 7.5, alignment: "center", color: BLACK, fillColor: WHITE },
          { text: "OVERALL RESULT", bold: true, fontSize: 7.5, alignment: "center", color: BLACK, fillColor: WHITE },
          { text: "CLASS RANK", bold: true, fontSize: 7.5, alignment: "center", color: BLACK, fillColor: WHITE },
        ],
        [
          {
            text: report.weightedAverage !== null ? `${report.weightedAverage}%` : "N/A",
            bold: true,
            fontSize: 11,
            alignment: "center",
            fillColor: PANEL_GREY,
          },
          { text: overallGrade(report.weightedAverage), bold: true, fontSize: 11, alignment: "center", fillColor: PANEL_GREY, color: overallGradeColor(report.weightedAverage) },
          {
            text: rankText,
            bold: true,
            fontSize: rankText.length > 8 ? 9 : 11,
            alignment: "center",
            fillColor: PANEL_GREY,
          },
        ],
      ],
    },
    layout: plainLayout,
    margin: [0, 0, 0, 4],
  };
}

// ---------- Student-info QR code: replaces the Parent/Guardian signature
// slot. Encodes only school name, school phone, student name, student code,
// class, marks (weighted average), and rank — as plain multi-line text so
// any phone camera / QR app can read it directly, no app-specific format
// required. ----------
function studentInfoQrData(schoolName, schoolPhone, report, className, classCategory) {
  const rankText =
    report.classRank !== undefined && report.classRank !== null && report.classRankTotal
      ? `${report.classRank} out of ${report.classRankTotal}`
      : "N/A";
  const marksText =
    report.weightedAverage !== null && report.weightedAverage !== undefined
      ? `${report.weightedAverage}%`
      : "N/A";
  const resolvedClassName = className || report.student?.class;
  const lines = [
    schoolName,
    schoolPhone,
    report.student?.name ? `Student: ${report.student.name}` : null,
    report.student?.admissionNumber ? `Student Code: ${report.student.admissionNumber}` : null,
    resolvedClassName ? `Class: ${classLabel(resolvedClassName, classCategory ?? report.student?.classCategory)}` : null,
    `Marks: ${marksText}`,
    `Rank: ${rankText}`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "Student Info";
}

// ---------- Signatures: no class teacher remarks (removed as unnecessary),
// no date lines — the generated date lives in the page footer instead (see
// docFooter below). Class Teacher and School Manager keep their signature
// lines; the third slot (previously Parent/Guardian) is now a QR code
// encoding the student's info (school name, school phone, student name,
// student code, class, marks, and rank). ----------
function remarksAndSignatures(report, schoolManagerName, schoolName, schoolPhone, className, classCategory) {
  return {
    unbreakable: true,
    stack: [
      sectionLabel("SIGNATURES"),
      {
        columns: [
          {
            stack: [
              { text: report.classTeacherName || "Not assigned", bold: true, fontSize: 10 },
              { text: "CLASS TEACHER", fontSize: 7, color: BLACK, margin: [0, 1, 0, 0] },
            ],
          },
          {
            stack: [
              { text: schoolManagerName || "Not assigned", bold: true, fontSize: 10, alignment: "center" },
              { text: "SCHOOL MANAGER", fontSize: 7, color: BLACK, alignment: "center", margin: [0, 1, 0, 0] },
            ],
          },
          {
            stack: [
              {
                qr: studentInfoQrData(schoolName, schoolPhone, report, className, classCategory),
                fit: 100,
                eccLevel: "M",
                foreground: BLACK,
                alignment: "right",
              },
              { text: "STUDENT INFO", fontSize: 7, color: BLACK, alignment: "right", margin: [0, 3, 0, 0] },
            ],
          },
        ],
      },
    ],
  };
}

// ---------- Footer: generated date + class name, drawn as the last block
// INSIDE the bordered card content (not a pdfmake page `footer`, which
// draws below the page margin and outside the outer border box). Matches
// the frontend's report-card footer exactly. ----------
function cardFooter(className, classCategory) {
  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return {
    table: {
      widths: ["*", "*"],
      body: [
        [
          { text: `Generated: ${generatedOn}`, fontSize: 7.5, color: "#6b7280" },
          {
            text: `Class: ${classLabel(className, classCategory)}`,
            fontSize: 7.5,
            color: "#6b7280",
            alignment: "right",
          },
        ],
      ],
    },
    layout: {
      // Only draw the top line (i === 0) as a divider above the footer text
      // — no bottom line, since this sits at the very bottom of the card,
      // inside the outer border.
      hLineWidth: (i) => (i === 0 ? 1 : 0),
      vLineWidth: () => 0,
      hLineColor: () => "#d1d5db",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 6,
      paddingBottom: () => 0,
    },
    margin: [0, 14, 0, 0],
  };
}

/**
 * Builds the full report card as a set of distinct, template-styled
 * sections: colored banner, student panel, academic performance table,
 * comments & summary, signatures.
 */
// ---------- Outer border: the ONE border for the whole report card. Every
// section inside (banner, student panel, summary strip, signatures) is
// plain/borderless — only the Academic Performance table keeps its own
// bordered grid — so this is the sole box outline framing the page. ----------
function outerBorder(content) {
  return {
    table: {
      widths: ["*"],
      // NOTE: no `border` override on this cell — this is the ONLY cell in
      // the table, so it owns all four outer edges. A per-cell `border:
      // [false,false,false,false]` here was previously suppressing exactly
      // the outer border the layout below is meant to draw. Leaving border
      // unset lets the table's own layout (hLineWidth/vLineWidth) draw it.
      body: [[{ stack: content }]],
    },
    layout: {
      hLineWidth: () => 1.5,
      vLineWidth: () => 1.5,
      hLineColor: () => BLACK,
      vLineColor: () => BLACK,
      paddingLeft: () => 14,
      paddingRight: () => 14,
      paddingTop: () => 14,
      paddingBottom: () => 14,
    },
  };
}

// Watermark shows the class name (previously the school name) — mirrors
// watermarkText() in frontend/src/pages/Reports.jsx so the on-screen/print
// watermark and the PDF watermark always show the same text.
function watermarkText(className) {
  return (className || "Class").trim().toUpperCase();
}

// Faint diagonal class-name watermark, drawn ONCE (not tiled) and centered
// behind the report card content on every page. Returned as a pdfmake
// `background` function so it's redrawn automatically on each physical page
// (including every student's page in a full-class export). Very low
// opacity keeps it from interfering with legibility or B&W printing.
// Mirrors the identical single diagonal watermark drawn in the on-screen/
// print view — see the <svg className="report-watermark-svg"> in
// frontend/src/pages/Reports.jsx.
function diagonalWatermarkSvg(className) {
  const word = watermarkText(className);
  const svg = `
    <svg viewBox="0 0 640 900" xmlns="http://www.w3.org/2000/svg">
      <text x="320" y="450" font-size="52" font-weight="700" fill="#000000" fill-opacity="0.08" letter-spacing="2" text-anchor="middle" transform="rotate(-28 320 450)">${word}</text>
    </svg>`;
  return function (currentPage, pageSize) {
    const width = Math.min(480, pageSize.width - 72);
    const height = (width * 900) / 640;
    return {
      svg,
      width,
      absolutePosition: {
        x: (pageSize.width - width) / 2,
        y: pageSize.height / 2 - height / 2,
      },
    };
  };
}

function reportCardContent(report, schoolName, schoolAddress, className, termName, schoolManagerName, schoolEmail, schoolPhone, classCategory) {
  return [
    outerBorder(
      [
        letterhead(
          schoolName,
          schoolAddress,
          termName,
          report.student?.admissionNumber,
          report,
          className,
          schoolEmail,
          schoolPhone,
          classCategory
        ),
        sectionLabel("ACADEMIC PERFORMANCE", SECTION_TITLE_COLOR, 13),
        moduleTable(report.modules),
        naNote(report.modules),
        summaryStrip(report),
        // Signatures + footer are wrapped together as ONE unbreakable unit.
        // Previously the footer was a separate block right after signatures
        // — when signatures just barely fit at the bottom of a page,
        // pdfmake would push ONLY the small footer table onto a new page by
        // itself, leaving it orphaned below an otherwise-finished card.
        // Combining them means they now always move as a pair: either both
        // fit on the current page, or both move to the next page together.
        {
          unbreakable: true,
          stack: [
            remarksAndSignatures(report, schoolManagerName, schoolName, schoolPhone, className, classCategory),
            cardFooter(className, classCategory),
          ],
        },
      ].filter(Boolean)
    ),
  ];
}

/**
 * Generates a single-student report card PDF. Returns a Buffer.
 */
function generateReportCardPdf(
  report,
  schoolName = "School Name",
  schoolManagerName = null,
  schoolAddress = null,
  schoolEmail = null,
  schoolPhone = null
) {
  const docDefinition = {
    pageMargins: [36, 36, 36, 36],
    background: diagonalWatermarkSvg(report.student.class),
    content: reportCardContent(
      report,
      schoolName,
      schoolAddress,
      report.student.class,
      report.term,
      schoolManagerName,
      schoolEmail,
      schoolPhone,
      report.student.classCategory
    ),
    defaultStyle: { font: "Roboto", fontSize: 10, color: BLACK },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

/**
 * Generates a full-class report PDF: one page per student.
 */
function generateClassReportPdf(
  reports,
  className,
  schoolName = "School Name",
  schoolManagerName = null,
  schoolAddress = null,
  schoolEmail = null,
  schoolPhone = null,
  classCategory = null
) {
  const content = [];
  reports.forEach((report, idx) => {
    if (idx > 0) content.push({ text: "", pageBreak: "before" });
    content.push(
      ...reportCardContent(
        report,
        schoolName,
        schoolAddress,
        className,
        report.term,
        schoolManagerName,
        schoolEmail,
        schoolPhone,
        classCategory ?? report.student?.classCategory
      )
    );
  });

  const docDefinition = {
    pageMargins: [36, 36, 36, 36],
    background: diagonalWatermarkSvg(className),
    content,
    defaultStyle: { font: "Roboto", fontSize: 10, color: BLACK },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

/**
 * Generates a "marks evidence" PDF for a single module/class/term — a
 * teacher's proof of what they recorded (and who's missing a mark), rather
 * than a student-facing report card. Every student in the class is listed,
 * including any without a recorded score yet, so gaps are visible too.
 * (Out of scope for the report-card redesign — left as its own self-contained
 * styling below so it keeps working unchanged.)
 */
const GREEN = "#1f7a4d";
const RED = "#b3403a";
const BLUE = "#1d4ed8"; // not recorded — matches the frontend's N/A color
const TEAL = "#0d9488"; // matches the frontend's teacher accent color
const ROSE = "#be185d";
const GREEN_BG = "#e7f6ee";
const RED_BG = "#fbebea";
const BLUE_BG = "#eaf1fd";
const ROSE_BG = "#fce7f3";
const ROW_ALT_BG = "#f7f8fa";

const evidenceStyles = {
  reportTitle: { fontSize: 16, bold: true, color: "#ffffff" },
  reportSubtitle: { fontSize: 9, color: "#d7f0ec", margin: [0, 3, 0, 0] },
  studentMeta: { fontSize: 9, color: "#6b7280" },
  tableHeaderCell: { fontSize: 9, bold: true, color: "#ffffff" },
  tableCell: { fontSize: 10, color: "#1f2937" },
  statLabel: { fontSize: 8, color: "#6b7280", bold: true },
  statValue: { fontSize: 15, bold: true, color: "#111827" },
  footerText: { fontSize: 8, color: "#9ca3af" },
};

const evidenceTableLayout = {
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
  vLineWidth: () => 0,
  hLineColor: (i) => (i <= 1 ? TEAL : "#e5e7eb"),
  paddingLeft: () => 10,
  paddingRight: () => 10,
  paddingTop: () => 7,
  paddingBottom: () => 7,
};

// Teal banner across the top with the school name, mirroring the app's
// teacher-role accent color so the document reads as part of the same
// product rather than a generic export.
function evidenceHeaderBanner(schoolName, moduleTitle, moduleCode, className, termName) {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            fillColor: TEAL,
            border: [false, false, false, false],
            stack: [
              { text: schoolName || "School", style: "reportTitle" },
              { text: "MARKS EVIDENCE REPORT", style: "reportSubtitle" },
              {
                text: `${moduleTitle}${moduleCode ? ` (${moduleCode})` : ""}  ·  ${className}  ·  ${termName}`,
                style: "reportSubtitle",
                margin: [0, 1, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    layout: { paddingTop: () => 14, paddingBottom: () => 14, paddingLeft: () => 16, paddingRight: () => 16 },
    margin: [0, 0, 0, 16],
  };
}

// A small colored "pill" cell — background tint + matching text color — for
// the status column, echoing the badge styling used on screen.
function statusPill(text, color, background) {
  return {
    table: { widths: ["*"], body: [[{ text, alignment: "center", bold: true, fontSize: 8.5, color }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => background,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

function statCard(label, value) {
  return {
    table: {
      widths: ["*"],
      body: [
        [{ text: label.toUpperCase(), style: "statLabel" }],
        [{ text: value, style: "statValue", margin: [0, 2, 0, 0] }],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => "#f7f8fa",
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

function generateMarksEvidencePdf(data, schoolName = "School Name") {
  const { moduleTitle, moduleCode, className, termName, teacherName, maxScore, passingLine, rows, generatedAt } = data;

  const recordedCount = rows.filter((r) => r.score !== null).length;
  const passCount = rows.filter((r) => r.score !== null && r.score >= passingLine).length;
  const average =
    recordedCount > 0
      ? +(rows.reduce((sum, r) => sum + (r.score ?? 0), 0) / recordedCount).toFixed(2)
      : null;

  const tableBody = [
    [
      { text: "#", style: "tableHeaderCell" },
      { text: "Student", style: "tableHeaderCell" },
      { text: "Admission No.", style: "tableHeaderCell" },
      { text: "Score", style: "tableHeaderCell", alignment: "center" },
      { text: "Status", style: "tableHeaderCell", alignment: "center", border: [false, false, false, false] },
    ],
    ...rows.map((r, idx) => {
      const fillColor = idx % 2 === 1 ? ROW_ALT_BG : undefined;
      const status =
        r.score === null
          ? statusPill("NOT RECORDED", BLUE, BLUE_BG)
          : r.score >= passingLine
          ? statusPill("PASS", GREEN, GREEN_BG)
          : statusPill("FAIL", RED, RED_BG);
      return [
        { text: String(idx + 1), style: "tableCell", fillColor },
        { text: r.studentName, style: "tableCell", bold: true, fillColor },
        { text: r.admissionNumber || "-", style: "tableCell", fillColor },
        {
          text: r.score === null ? "N/A" : `${r.score} / ${maxScore}`,
          style: "tableCell",
          alignment: "center",
          italics: r.score === null,
          color: r.score === null ? BLUE : undefined,
          fillColor,
        },
        { ...status, fillColor, margin: [0, 0, 0, 0] },
      ];
    }),
  ];

  // Header row gets the teal fill; apply it via the layout instead of the
  // table.headerRows fillColor shorthand so it renders reliably with pdfmake.
  tableBody[0].forEach((cell) => {
    cell.fillColor = TEAL;
  });

  const docDefinition = {
    pageMargins: [36, 0, 36, 40],
    content: [
      evidenceHeaderBanner(schoolName, moduleTitle, moduleCode, className, termName),
      {
        columns: [
          statCard("Recorded", `${recordedCount} / ${rows.length}`),
          statCard("Class Average", average !== null ? `${average} / ${maxScore}` : "—"),
          statCard("Passing", recordedCount > 0 ? `${passCount} / ${recordedCount}` : "—"),
        ],
        columnGap: 10,
        margin: [0, 0, 0, 14],
      },
      {
        columns: [
          { text: `Teacher: ${teacherName}`, style: "studentMeta" },
          { text: `Generated: ${generatedAt}`, style: "studentMeta", alignment: "right" },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        table: { headerRows: 1, widths: ["auto", "*", "auto", "auto", "auto"], body: tableBody },
        layout: evidenceTableLayout,
      },
      {
        text: "Teacher's Signature: ________________________",
        fontSize: 9,
        color: "#6b7280",
        margin: [0, 40, 0, 0],
      },
    ],
    styles: evidenceStyles,
    defaultStyle: { font: "Roboto", fontSize: 10 },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

// Thin single-line border variants, used only by the student list report —
// kept separate from blackGridLayout/outerBorder (used by the report card)
// so this change can't affect any other PDF.
const THIN = 0.5;

const thinGridLayout = {
  hLineWidth: () => THIN,
  vLineWidth: () => THIN,
  hLineColor: () => BLACK,
  vLineColor: () => BLACK,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

function thinOuterBorder(content) {
  return {
    table: {
      widths: ["*"],
      body: [[{ stack: content }]],
    },
    layout: {
      hLineWidth: () => THIN,
      vLineWidth: () => THIN,
      hLineColor: () => BLACK,
      vLineColor: () => BLACK,
      paddingLeft: () => 14,
      paddingRight: () => 14,
      paddingTop: () => 14,
      paddingBottom: () => 14,
    },
  };
}

// Plain, borderless header for the student list report — school name,
// report title, then class/teacher/contact details. No border here: the
// only borders on this page are the single thin outer border around
// everything, plus the student table's own thin grid further down.
function studentListHeader(schoolName, className, academicYearName, classTeacherName, schoolPhone, schoolEmail, schoolAddress, generatedAt) {
  const infoRow = (leftText, rightText) => ({
    columns: [
      { text: leftText, fontSize: 9.5 },
      { text: rightText || "", fontSize: 9.5, alignment: "right" },
    ],
    margin: [0, 2, 0, 0],
  });

  return {
    stack: [
      { text: schoolName || "School", alignment: "center", fontSize: 16, bold: true, color: BLACK },
      {
        text: "CLASS STUDENT LIST",
        alignment: "center",
        fontSize: 10.5,
        bold: true,
        color: "#444444",
        margin: [0, 3, 0, 10],
      },
      infoRow(`Class: ${className || "-"}`, `Generated: ${generatedAt}`),
      infoRow(academicYearName ? `Academic Year: ${academicYearName}` : "", schoolPhone ? `Phone: ${schoolPhone}` : ""),
      infoRow(`Class Teacher: ${classTeacherName || "-"}`, ""),
      infoRow(schoolEmail ? `Email: ${schoolEmail}` : "", schoolAddress ? `Location: ${schoolAddress}` : ""),
    ],
    margin: [0, 0, 0, 14],
  };
}

// Plain, borderless summary line (Total / Male / Female) sitting between
// the header and the bordered student table.
function studentListSummary(total, maleCount, femaleCount) {
  return {
    columns: [
      { text: `Total Students: ${total}`, fontSize: 9.5, bold: true },
      { text: `Male: ${maleCount}`, fontSize: 9.5, alignment: "center" },
      { text: `Female: ${femaleCount}`, fontSize: 9.5, alignment: "right" },
    ],
    margin: [0, 0, 0, 12],
  };
}

// Borderless footer, drawn as the last block inside the outer border —
// same convention as cardFooter() on the report card.
function studentListFooter(schoolName) {
  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return {
    table: {
      widths: ["*", "*"],
      body: [
        [
          { text: `Generated: ${generatedOn}`, fontSize: 7.5, color: "#6b7280" },
          { text: schoolName || "", fontSize: 7.5, color: "#6b7280", alignment: "right" },
        ],
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 0 ? THIN : 0),
      vLineWidth: () => 0,
      hLineColor: () => BLACK,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 6,
      paddingBottom: () => 0,
    },
    margin: [0, 14, 0, 0],
  };
}

// GET .../students/pdf — a manager's printable roster for a single class:
// every enrolled student with DOB, sex and guardian contact info, so it can
// double as a call sheet or a guardian-contact list. Kept strictly
// black-and-white: a single thin black outer border frames the whole page,
// the header/summary/footer sections are plain (no borders), and only the
// student list itself is a thin-bordered black-grid table.
function generateStudentListPdf(data, schoolName = "School Name") {
  const { className, academicYearName, classTeacherName, schoolPhone, schoolEmail, schoolAddress, rows, generatedAt } = data;

  const maleCount = rows.filter((r) => r.sex === "Male").length;
  const femaleCount = rows.filter((r) => r.sex === "Female").length;

  const headerCell = (text, alignment) => ({ text, bold: true, fontSize: 9, alignment: alignment || "left" });

  const tableBody = [
    [
      headerCell("#", "center"),
      headerCell("Student ID"),
      headerCell("Name"),
      headerCell("DOB", "center"),
      headerCell("Sex", "center"),
      headerCell("Guardian"),
      headerCell("Guardian Phone"),
    ],
    ...rows.map((r, idx) => [
      { text: String(idx + 1), fontSize: 9, alignment: "center" },
      { text: r.admissionNumber || "-", fontSize: 9 },
      { text: r.name, fontSize: 9, bold: true },
      { text: r.dob || "-", fontSize: 9, alignment: "center" },
      { text: r.sex || "-", fontSize: 9, alignment: "center" },
      { text: r.guardianName || "-", fontSize: 9 },
      { text: r.guardianPhone || "-", fontSize: 9 },
    ]),
  ];

  if (rows.length === 0) {
    tableBody.push([
      { text: "No students enrolled in this class yet.", colSpan: 7, alignment: "center", fontSize: 9, italics: true },
      {}, {}, {}, {}, {}, {},
    ]);
  }

  const studentTable = {
    table: {
      headerRows: 1,
      widths: [24, "auto", "*", "auto", "auto", "*", "auto"],
      dontBreakRows: true,
      body: tableBody,
    },
    layout: thinGridLayout,
  };

  const docDefinition = {
    pageMargins: [36, 36, 36, 50],
    content: [
      thinOuterBorder([
        studentListHeader(schoolName, className, academicYearName, classTeacherName, schoolPhone, schoolEmail, schoolAddress, generatedAt),
        studentListSummary(rows.length, maleCount, femaleCount),
        studentTable,
        studentListFooter(schoolName),
      ]),
    ],
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10, color: BLACK },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

module.exports = {
  generateReportCardPdf,
  generateClassReportPdf,
  generateMarksEvidencePdf,
  generateStudentListPdf,
  generateStudentRosterPdf,
  generateSchoolNumbersReportPdf,
};

// Borderless header for the flexible roster PDF (generateStudentRosterPdf) —
// same conventions as studentListHeader, but the class line becomes
// "Whole School" for a school-wide export, and a gender-filter line is
// always shown so it's obvious which subset of students this is.
function studentRosterHeader(schoolName, scopeLabel, academicYearName, classTeacherName, genderLabel, schoolPhone, schoolEmail, schoolAddress, generatedAt) {
  const infoRow = (leftText, rightText) => ({
    columns: [
      { text: leftText, fontSize: 9.5 },
      { text: rightText || "", fontSize: 9.5, alignment: "right" },
    ],
    margin: [0, 2, 0, 0],
  });

  return {
    stack: [
      { text: schoolName || "School", alignment: "center", fontSize: 16, bold: true, color: BLACK },
      {
        text: "STUDENT LIST",
        alignment: "center",
        fontSize: 10.5,
        bold: true,
        color: "#444444",
        margin: [0, 3, 0, 10],
      },
      infoRow(scopeLabel, `Generated: ${generatedAt}`),
      infoRow(academicYearName ? `Academic Year: ${academicYearName}` : "", `Filter: ${genderLabel}`),
      ...(classTeacherName ? [infoRow(`Class Teacher: ${classTeacherName}`, schoolPhone ? `Phone: ${schoolPhone}` : "")] : [infoRow(schoolPhone ? `Phone: ${schoolPhone}` : "", "")]),
      infoRow(schoolEmail ? `Email: ${schoolEmail}` : "", schoolAddress ? `Location: ${schoolAddress}` : ""),
    ],
    margin: [0, 0, 0, 14],
  };
}

// GET .../students/roster/pdf — a flexible, printable student list: either a
// single class or the whole school, optionally narrowed to boys only, girls
// only, or everyone. Deliberately excludes guardian name/phone (unlike
// generateStudentListPdf's single-class roster, this is meant as a quick
// headcount/name list, not a guardian-contact sheet). When it covers the
// whole school, a Class column is added so each row still says where the
// student belongs.
function generateStudentRosterPdf(data, schoolName = "School Name") {
  const { scope, className, academicYearName, classTeacherName, genderLabel, schoolPhone, schoolEmail, schoolAddress, rows, generatedAt } = data;
  const isSchoolWide = scope === "school";

  const maleCount = rows.filter((r) => r.sex === "Male").length;
  const femaleCount = rows.filter((r) => r.sex === "Female").length;

  const headerCell = (text, alignment) => ({ text, bold: true, fontSize: 9, alignment: alignment || "left" });

  const columns = ["#", "Student ID", "Name", "DOB", "Sex", ...(isSchoolWide ? ["Class"] : [])];
  const widths = [24, "auto", "*", "auto", "auto", ...(isSchoolWide ? ["auto"] : [])];

  const tableBody = [
    columns.map((c, idx) => headerCell(c, idx === 0 || c === "DOB" || c === "Sex" ? "center" : "left")),
    ...rows.map((r, idx) => [
      { text: String(idx + 1), fontSize: 9, alignment: "center" },
      { text: r.admissionNumber || "-", fontSize: 9 },
      { text: r.name, fontSize: 9, bold: true },
      { text: r.dob || "-", fontSize: 9, alignment: "center" },
      { text: r.sex || "-", fontSize: 9, alignment: "center" },
      ...(isSchoolWide ? [{ text: r.className || "-", fontSize: 9 }] : []),
    ]),
  ];

  if (rows.length === 0) {
    tableBody.push([
      { text: "No students match this selection.", colSpan: columns.length, alignment: "center", fontSize: 9, italics: true },
      ...Array(columns.length - 1).fill({}),
    ]);
  }

  const studentTable = {
    table: {
      headerRows: 1,
      widths,
      dontBreakRows: true,
      body: tableBody,
    },
    layout: thinGridLayout,
  };

  const scopeLabel = isSchoolWide ? "Whole School — All Classes" : `Class: ${className || "-"}`;

  const docDefinition = {
    pageMargins: [36, 36, 36, 50],
    content: [
      thinOuterBorder([
        studentRosterHeader(schoolName, scopeLabel, academicYearName, isSchoolWide ? null : classTeacherName, genderLabel, schoolPhone, schoolEmail, schoolAddress, generatedAt),
        studentListSummary(rows.length, maleCount, femaleCount),
        studentTable,
        studentListFooter(schoolName),
      ]),
    ],
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10, color: BLACK },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

// Borderless header for the numbers-only school report — same conventions
// as studentRosterHeader, but titled for a headcount/enrollment summary
// rather than a name list.
function schoolReportHeader(schoolName, academicYearName, schoolPhone, schoolEmail, schoolAddress, generatedAt) {
  const infoRow = (leftText, rightText) => ({
    columns: [
      { text: leftText, fontSize: 9.5 },
      { text: rightText || "", fontSize: 9.5, alignment: "right" },
    ],
    margin: [0, 2, 0, 0],
  });

  return {
    stack: [
      { text: schoolName || "School", alignment: "center", fontSize: 16, bold: true, color: BLACK },
      {
        text: "SCHOOL REPORT — NUMBERS SUMMARY",
        alignment: "center",
        fontSize: 10.5,
        bold: true,
        color: "#444444",
        margin: [0, 3, 0, 10],
      },
      infoRow(academicYearName ? `Academic Year: ${academicYearName}` : "", `Generated: ${generatedAt}`),
      infoRow(schoolPhone ? `Phone: ${schoolPhone}` : "", schoolEmail ? `Email: ${schoolEmail}` : ""),
      infoRow(schoolAddress ? `Location: ${schoolAddress}` : "", ""),
    ],
    margin: [0, 0, 0, 14],
  };
}

// A row of plain (borderless) count boxes — Students / Boys / Girls /
// Classes / Teachers / Modules — sitting right under the header, mirroring
// the StatCard row on the manager's Statistics page but as static numbers.
function overviewNumberRow(overview) {
  const cell = (value, label) => ({
    stack: [
      { text: String(value), fontSize: 18, bold: true, alignment: "center" },
      { text: label, fontSize: 8, color: "#6b7280", alignment: "center", margin: [0, 2, 0, 0] },
    ],
  });

  return {
    table: {
      widths: ["*", "*", "*", "*", "*", "*"],
      body: [
        [
          cell(overview.totalStudents, "Total Students"),
          cell(overview.boys, "Boys"),
          cell(overview.girls, "Girls"),
          cell(overview.totalClasses, "Classes"),
          cell(overview.activeTeachers, "Active Teachers"),
          cell(overview.totalModules, "Modules"),
        ],
      ],
    },
    layout: plainLayout,
    margin: [0, 0, 0, 16],
  };
}

// GET .../statistics/report/pdf — a manager's numbers-only school report:
// total enrollment, gender split, class/teacher/module counts, and a
// per-class breakdown table — no student names or personal details at all,
// just counts. Kept strictly black-and-white like the other roster/list
// PDFs, with a single thin outer border and a thin-bordered grid for the
// per-class table.
function generateSchoolNumbersReportPdf(data, schoolName = "School Name") {
  const { academicYearName, overview, classGenderBreakdown, schoolPhone, schoolEmail, schoolAddress, generatedAt } = data;

  const headerCell = (text, alignment) => ({ text, bold: true, fontSize: 9, alignment: alignment || "center" });

  const tableBody = [
    [
      headerCell("#", "center"),
      headerCell("Class", "left"),
      headerCell("Students", "center"),
      headerCell("Boys", "center"),
      headerCell("Girls", "center"),
    ],
    ...classGenderBreakdown.map((c, idx) => [
      { text: String(idx + 1), fontSize: 9, alignment: "center" },
      { text: c.className, fontSize: 9, bold: true },
      { text: String(c.totalStudents), fontSize: 9, alignment: "center" },
      { text: String(c.boys), fontSize: 9, alignment: "center" },
      { text: String(c.girls), fontSize: 9, alignment: "center" },
    ]),
    [
      { text: "TOTAL", fontSize: 9, bold: true, colSpan: 2 },
      {},
      { text: String(overview.totalStudents), fontSize: 9, bold: true, alignment: "center" },
      { text: String(overview.boys), fontSize: 9, bold: true, alignment: "center" },
      { text: String(overview.girls), fontSize: 9, bold: true, alignment: "center" },
    ],
  ];

  if (classGenderBreakdown.length === 0) {
    tableBody.splice(1, 0, [
      { text: "No classes in the current academic year yet.", colSpan: 5, alignment: "center", fontSize: 9, italics: true },
      {}, {}, {}, {},
    ]);
  }

  const classTable = {
    table: {
      headerRows: 1,
      widths: [24, "*", "auto", "auto", "auto"],
      dontBreakRows: true,
      body: tableBody,
    },
    layout: thinGridLayout,
  };

  const staffModulesRow = {
    columns: [
      { text: `Total Teachers: ${overview.totalTeachers}`, fontSize: 9.5 },
      { text: `Active Teachers: ${overview.activeTeachers}`, fontSize: 9.5, alignment: "center" },
      { text: `Modules: ${overview.totalModules}`, fontSize: 9.5, alignment: "right" },
    ],
    margin: [0, 14, 0, 0],
  };

  const docDefinition = {
    pageMargins: [36, 36, 36, 50],
    content: [
      thinOuterBorder([
        schoolReportHeader(schoolName, academicYearName, schoolPhone, schoolEmail, schoolAddress, generatedAt),
        overviewNumberRow(overview),
        { text: "Enrollment by Class", fontSize: 10.5, bold: true, margin: [0, 0, 0, 6] },
        classTable,
        staffModulesRow,
        studentListFooter(schoolName),
      ]),
    ],
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10, color: BLACK },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
