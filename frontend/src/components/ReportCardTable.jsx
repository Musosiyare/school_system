import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// Report title heading color (navy blue, bold). This is the one spot on the
// otherwise black-and-white report card that's intentionally colored.
const REPORT_TITLE_COLOR = "#0a2f5c";
// "ACADEMIC PERFORMANCE" section label color — same navy blue as
// REPORT_TITLE_COLOR. Other section labels (e.g. SIGNATURES) stay black.
const SECTION_TITLE_COLOR = "#0a2f5c";

// Appends the class's education track — TSS (Technical Secondary School) or
// GE (General Education) — next to its name, e.g. "S1A (TSS)". Mirrors
// classLabel() in the backend's pdfService.js.
export function classLabel(className, classCategory) {
  const name = className || "-";
  if (classCategory !== "TSS" && classCategory !== "GE") return name;
  return `${name} (${classCategory})`;
}

// Full track name shown ahead of the report card title, e.g.
// "TECHNICAL SECONDARY SCHOOL / MID-TERM REPORT CARD". Mirrors
// categoryFullName()/reportCardTitle() in the backend's pdfService.js.
function categoryFullName(classCategory) {
  if (classCategory === "TSS") return "TECHNICAL SECONDARY SCHOOL";
  if (classCategory === "GE") return "GENERAL EDUCATION";
  return null;
}

function reportCardTitle(classCategory) {
  const prefix = categoryFullName(classCategory);
  return prefix ? `${prefix} / MID-TERM REPORT CARD` : "MID-TERM REPORT CARD";
}

// Encodes only school name, school phone, student name, student code,
// class, marks (weighted average), and rank — as plain multi-line text,
// readable by any QR scanner without needing a special format. Mirrors
// studentInfoQrData() in the backend's pdfService.js so the on-screen/print
// report and the downloaded PDF show the same data.
function studentInfoQrValue(schoolName, schoolPhone, report, className, classCategory) {
  const rankText =
    report.classRank != null && report.classRankTotal
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

// PASS/FAIL is displayed using competency-based terminology: C (Competent) /
// NYC (Not Yet Competent). Each module's decision comes only from that
// module's own pass mark (never the weight), exactly as the backend already
// computes `status`.
export function toDecision(word) {
  if (word === "PASS") return "C";
  if (word === "FAIL") return "NYC";
  if (word === "NOT RECORDED") return "N/A";
  return word;
}

// Modules arrive pre-grouped by type from the backend (specific, then
// general, then complementary). This tags the first row of each group with
// how many rows it should span, so the "Module Type" column can render as
// one merged cell per group instead of repeating on every row.
function withTypeGroups(modules) {
  const counts = {};
  modules.forEach((m) => {
    const t = m.type || "general";
    counts[t] = (counts[t] || 0) + 1;
  });
  const seen = {};
  return modules.map((m) => {
    const t = m.type || "general";
    const isFirstOfGroup = !seen[t];
    seen[t] = true;
    return { ...m, isFirstOfGroup, groupSize: counts[t] };
  });
}

// Overall Result is graded off the weighted average itself, not the plain
// PASS/FAIL flag: Excellent 80-100, Very Good 70-79, Pass 50-69, else Fail.
// Mirrors overallGrade() in backend/src/services/pdfService.js.
function overallGrade(weightedAverage) {
  if (weightedAverage === null || weightedAverage === undefined) return "N/A";
  if (weightedAverage >= 80) return "EXCELLENT";
  if (weightedAverage >= 70) return "VERY GOOD";
  if (weightedAverage >= 50) return "PASS";
  return "FAIL";
}

// Letter grade shown in the class report list's "Grade" column — based
// purely on the weighted average, independent of the PASS/FAIL competency
// flag: A 80-100 (A+ for 90-100), B 70-79 (B+ for 75-79), C 60-69
// (C+ for 65-69), Pass 50-59, Fail 0-49.
export function letterGrade(weightedAverage) {
  if (weightedAverage === null || weightedAverage === undefined) return "N/A";
  const n = Number(weightedAverage);
  if (Number.isNaN(n)) return "N/A";
  if (n >= 90) return "A+";
  if (n >= 80) return "A";
  if (n >= 75) return "B+";
  if (n >= 70) return "B";
  if (n >= 65) return "C+";
  if (n >= 60) return "C";
  if (n >= 50) return "Pass";
  return "Fail";
}

// Mirrors conductText() in the backend's pdfService.js.
// Good at >= 20/40 (half), Bad below — same threshold as SBMS's atRisk flag.
// Overall Result and Conduct are both shown in plain black text — no
// color-coding — mirrors the backend's pdfService.js.
function conductText(conduct) {
  if (!conduct) return "N/A";
  return `${conduct.remaining}/${conduct.maxMarks}`;
}

// Mirrors deliberationState() in the backend's pdfService.js — dismissal
// (from SBMS's shared decision) always wins over the plain conduct
// reading; "retained" or no decision at all falls back to Good/Bad from
// the raw conduct number.
function deliberationState(report) {
  const decision = report.dismissal?.decision;
  if (decision === "dismissed_permanently") return "dismissed_permanently";
  if (decision === "dismissed_term") return "dismissed_term";
  if (!report.conduct) return null;
  return report.conduct.atRisk ? "bad" : "good";
}

// Watermark shows the class name (previously the school name). Mirrors
// watermarkText() in backend/src/services/pdfService.js so the on-screen/
// print watermark and the PDF watermark always show the same text.
function watermarkText(className) {
  return (className || "Class").trim().toUpperCase();
}

const th = { textAlign: "left" };
const center = { textAlign: "center" };

// Print fitting (issue 1): a report with many modules used to overflow a
// single printed A4 page and spill a few rows onto a second page, because
// every row was always rendered at the same font size regardless of how
// many rows there were. This shrinks the Academic Performance table's base
// font size (and cell padding) as the module count grows, so the whole
// table — and therefore the whole card — keeps fitting on one page.
function tableFontSizeFor(moduleCount) {
  if (moduleCount > 22) return 9;
  if (moduleCount > 18) return 10;
  if (moduleCount > 14) return 10.5;
  if (moduleCount > 10) return 11.5;
  return 13;
}
function cellPaddingVFor(moduleCount) {
  if (moduleCount > 20) return 1.5;
  if (moduleCount > 14) return 2.5;
  return 3;
}

// Print fitting (issue 2, Module Code): same idea as titleFontSizeFor, but
// tuned for the Code column's narrower width (it holds short codes like
// "MATH101", but a longer one could still overflow at the table's normal
// size).
function codeFontSizeFor(code, tableFontSize) {
  const len = (code || "").length;
  let size = tableFontSize;
  if (len > 12) size = 8;
  else if (len > 9) size = 9.5;
  else if (len > 7) size = 11;
  return Math.min(size, tableFontSize);
}

// Print fitting (Module Type label): "complementary" is long enough that,
// at the column's normal font size, its final letter would wrap onto a
// second line. Shrinks just that label's font size when it's a long word,
// and is paired with whiteSpace: nowrap in the JSX below so it stays on one
// line instead of breaking mid-word.
function typeFontSizeFor(type, tableFontSize) {
  const base = Math.min(11, tableFontSize);
  const len = (type || "").length;
  if (len > 11) return Math.min(base, 9);
  return base;
}
// line because the column has a fixed width. Instead of letting it wrap,
// each row's name is kept on one line (whiteSpace: nowrap below) and its
// own font size is shrunk based on how long that particular name is — short
// names stay at the table's normal size, only long ones get smaller. Never
// goes above the table's own (already-shrunk) font size.
function titleFontSizeFor(title, tableFontSize) {
  const len = (title || "").length;
  let size = tableFontSize;
  if (len > 70) size = 7;
  else if (len > 55) size = 8;
  else if (len > 45) size = 9;
  else if (len > 35) size = 10;
  else if (len > 28) size = 11;
  return Math.min(size, tableFontSize);
}

function SectionLabel({ children, color, fontSize }) {
  return (
    <div
      className={color ? "report-section-label report-section-title-color" : "report-section-label"}
      style={{
        background: "#ffffff",
        color: color || "#000000",
        fontWeight: 700,
        fontSize: fontSize || 11,
        padding: "6px 10px",
        margin: "10px 0 8px",
      }}
    >
      {children}
    </div>
  );
}

// Small bordered square, a checkmark centered when ticked. Note: the
// downloaded PDF (tickboxCell() in the backend's pdfService.js) still uses
// "X" for the tick, since that PDF only ships Helvetica's standard 14
// fonts, which don't include a checkmark glyph.
function Tickbox({ ticked }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 11,
        height: 11,
        border: "1px solid #000",
        fontSize: 8,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {ticked ? <span style={{ fontWeight: 900, fontSize: 10 }}>✓</span> : ""}
    </span>
  );
}

function DeliberationRow({ ticked, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
      <Tickbox ticked={ticked} />
      <span style={{ fontSize: 8, color: color || "#000" }}>{label}</span>
    </div>
  );
}

// Mirrors deliberationBox() in the backend's pdfService.js — exactly one
// of the four boxes ticked, based on deliberationState().
function DeliberationGrid({ state }) {
  return (
    <div className="report-avoid-break" style={{ marginBottom: 6 }}>
      <SectionLabel fontSize={9}>DELIBERATION</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 8px" }}>
        <div style={{ display: "flex", gap: 16 }}>
          <DeliberationRow ticked={state === "good"} label="Good behavior" />
          <DeliberationRow ticked={state === "bad"} label="Bad behavior" />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <DeliberationRow ticked={state === "dismissed_term"} label="Dismissed this term" />
          <DeliberationRow ticked={state === "dismissed_permanently"} label="Dismissed permanently" />
        </div>
      </div>
    </div>
  );
}

// Shows the school's uploaded logo (set on the admin Profile page) at a
// fixed height so it lines up with the old GraduationCap icon it replaces.
// Falls back to that icon if no logo URL is set, or if the URL fails to
// load (broken link, so the report still prints something recognizable
// instead of a blank space).
function SchoolLogo({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <GraduationCap size={80} color="#0a1f44" style={{ marginBottom: 4 }} />;
  }
  return (
    <img
      src={url}
      alt="School logo"
      onError={() => setFailed(true)}
      style={{ height: 80, maxWidth: 220, objectFit: "contain", display: "block", marginBottom: 4 }}
    />
  );
}

// The report card as a set of distinct sections — colored banner, student
// panel, academic performance table, comments & summary, signatures —
// matching the layout generated server-side for the PDF download (see
// backend/src/services/pdfService.js) and the reference template. Used on
// screen (Reports page and the teacher's read-only Past Years page) and for
// browser print.
// Black-and-white only: report cards are printed on B&W printers, so no
// background fills or colored text anywhere — everything below resolves to
// white backgrounds, black text, and black borders for section separation.
export default function ReportCardTable({
  report,
  schoolName,
  schoolAddress,
  schoolEmail,
  schoolPhone,
  schoolLogoUrl,
  className,
  classCategory,
  termName,
}) {
  const contactLine = [schoolPhone, schoolEmail].filter(Boolean).join("  ·  ");
  const tableFontSize = tableFontSizeFor(report.modules.length);
  const cellPaddingV = cellPaddingVFor(report.modules.length);
  return (
    // report-card-page is sized/scaled to fit one printed page — see
    // .report-card-page and its children in index.css. The border here is
    // the ONE border for the whole report card; individual sections
    // (banner, student panel, summary strip, signatures) stay plain white
    // with no border of their own — only the Academic Performance table
    // keeps its own bordered grid.
    <div
      className="report-card-page"
      style={{
        border: "1.5px solid #000",
        padding: "14px",
        position: "relative",
        "--report-title-color": REPORT_TITLE_COLOR,
        "--section-title-color": SECTION_TITLE_COLOR,
        "--report-table-font-size": `${tableFontSize}px`,
        "--report-cell-padding-v": `${cellPaddingV}px`,
      }}
    >
      {/* Banner: centered title/term on top, then school (left) and
          labeled student details (right) below — mirrors the PDF's
          letterhead() layout. Every line uses the same font size. */}
      <div className="report-avoid-break" style={{ padding: "10px 14px", marginBottom: 10 }}>
        <div className="report-title-color" style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: REPORT_TITLE_COLOR }}>
            {reportCardTitle(classCategory ?? report.student?.classCategory)}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: REPORT_TITLE_COLOR }}>
            {termName || report.term}
            {report.academicYear ? ` — ${report.academicYear}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <SchoolLogo url={schoolLogoUrl} />
            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{schoolName || "School"}</div>
            {schoolAddress && (
              <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{schoolAddress}</div>
            )}
            {contactLine && (
              <div style={{ fontSize: 10, color: "#000", marginTop: 2 }}>{contactLine}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>
              Student Name: {report.student?.name || "-"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>
              Class: {className || report.student?.class || "-"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>
              Student ID: {report.student?.admissionNumber || "-"}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel color={SECTION_TITLE_COLOR} fontSize={14}>ACADEMIC PERFORMANCE ANALYSIS - MID TERM REPORT</SectionLabel>

      <table className="report-table report-avoid-break" style={{ marginBottom: 4, tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "43%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            {/* Renamed from "Module Type" to just "Type" — a shorter label
                that comfortably fits the column's 13% width on one line at
                every table font size, so there's no need to rely on
                wrapping to avoid the header overflowing into "Code" (see
                the two-line wrap fix this replaces). */}
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: Math.min(14, tableFontSize + 1) }}>Type</th>
            <th style={{ ...th, whiteSpace: "nowrap", fontSize: Math.min(14, tableFontSize + 1) }}>Code</th>
            <th style={{ ...th, fontSize: Math.min(14, tableFontSize + 1) }}>Module Name</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: tableFontSize }}>Weight</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: tableFontSize }}>Score</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: tableFontSize }}>Decision</th>
          </tr>
        </thead>
        <tbody>
          {report.modules.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center" }}>
                No modules assigned to this class.
              </td>
            </tr>
          )}
          {withTypeGroups(report.modules).map((m) => (
            <tr key={m.moduleId} className="report-avoid-break">
              {m.isFirstOfGroup && (
                <td
                  rowSpan={m.groupSize}
                  style={{
                    ...center,
                    verticalAlign: "middle",
                    padding: "3px 5px",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                  }}
                >
                  {/* whiteSpace was "nowrap" here, which forced long words
                      like "complementary" onto a single line — but the
                      column is only 13% wide, so at that width the text
                      visually overflowed the cell border and spilled into
                      the Code column next to it. The cell already sets
                      overflowWrap/wordBreak: "break-word", so removing
                      nowrap lets a long label wrap onto a second line
                      (centered, since it has room via rowSpan) and stay
                      inside its own column instead of overflowing. */}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: typeFontSizeFor(m.type, tableFontSize),
                      textTransform: "capitalize",
                      lineHeight: 1.2,
                    }}
                  >
                    {m.type || "general"}
                  </div>
                  <div
                    style={{
                      fontSize: Math.min(9, tableFontSize - 1.5),
                      fontWeight: 400,
                      marginTop: 3,
                      lineHeight: 1.2,
                    }}
                  >
                    Passing line {(m.type || "general") === "specific" ? 70 : 50}%
                  </div>
                </td>
              )}
              <td
                style={{
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  padding: `${cellPaddingV}px 6px`,
                  fontSize: codeFontSizeFor(m.code, tableFontSize),
                }}
              >
                {m.code || "-"}
              </td>
              <td
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: titleFontSizeFor(m.title, tableFontSize),
                }}
              >
                {m.title}
              </td>
              <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "3px 6px" }}>{m.weight}</td>
              <td
                style={{
                  ...center,
                  fontWeight: m.score === null ? 700 : 400,
                  whiteSpace: "nowrap",
                  padding: "3px 6px",
                }}
              >
                {m.score === null ? "N/A" : m.score}
              </td>
              <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "3px 6px" }}>
                {toDecision(m.status)}
              </td>
            </tr>
          ))}
          <tr className="report-avoid-break">
            <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>
              TOTAL
            </td>
            <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "3px 6px" }}>
              {report.modules.reduce((sum, m) => sum + (m.weight || 0), 0)}
            </td>
            <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "3px 6px" }}>
              {report.modules.reduce((sum, m) => sum + (m.score || 0), 0)}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {report.modules.some((m) => m.score === null) && (
        <div
          className="report-avoid-break"
          style={{ fontSize: 7, color: "#000", fontStyle: "italic", marginBottom: 4 }}
        >
          N/A = mark not yet recorded for that module. It does not count against the student and has no effect on
          the weighted average or overall result below.
        </div>
      )}

      <table className="report-table report-avoid-break" style={{ marginBottom: 4 }}>
        <tbody>
          <tr>
            <th style={{ ...center, fontSize: 9, color: "#000", border: "none" }}>WEIGHTED AVERAGE</th>
            <th style={{ ...center, fontSize: 9, color: "#000", border: "none" }}>OVERALL RESULT</th>
            <th style={{ ...center, fontSize: 9, color: "#000", border: "none" }}>POSITION</th>
            <th style={{ ...center, fontSize: 9, color: "#000", border: "none" }}>CONDUCT</th>
          </tr>
          <tr>
            <td style={{ ...center, fontWeight: 700, fontSize: 12, border: "none" }}>
              {report.weightedAverage !== null ? `${report.weightedAverage}%` : "N/A"}
            </td>
            <td
              style={{
                ...center,
                fontWeight: 700,
                fontSize: 12,
                border: "none",
                color: "#000",
              }}
            >
              {overallGrade(report.weightedAverage)}
            </td>
            <td style={{ ...center, fontWeight: 700, fontSize: report.classRankTotal ? 10 : 12, border: "none" }}>
              {report.classRank != null && report.classRankTotal
                ? `${report.classRank} out of ${report.classRankTotal}`
                : "N/A"}
            </td>
            <td
              style={{
                ...center,
                fontWeight: 700,
                fontSize: 9.5,
                border: "none",
                color: "#000",
              }}
            >
              {conductText(report.conduct)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Deliberation + Signatures grouped as one "footer" block. Kept as a
          single group mostly for readability now — the card auto-sizes to
          its content, so this no longer needs any special pinning. */}
      <div className="report-footer">
        {deliberationState(report) && (
          <DeliberationGrid state={deliberationState(report)} />
        )}

        <SectionLabel>SIGNATURES</SectionLabel>

        <div className="report-avoid-break" style={{ marginTop: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11 }}>{report.classTeacherName || "Not assigned"}</div>
            <div style={{ fontSize: 8, color: "#000" }}>CLASS TEACHER</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 11 }}>{report.schoolManagerName || "Not assigned"}</div>
            <div style={{ fontSize: 8, color: "#000" }}>SCHOOL MANAGER</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <QRCodeSVG
              value={studentInfoQrValue(schoolName, schoolPhone, report, className, classCategory)}
              size={92}
              level="M"
              style={{ display: "block", marginLeft: "auto" }}
            />
            <div style={{ fontSize: 8, color: "#000", marginTop: 3 }}>STUDENT INFO</div>
          </div>
        </div>

        {/* Footer: generated date + class name, replacing the per-signature
            date lines. Intentionally kept a lighter gray — this is a print
            timestamp, not report content. */}
        <div
          style={{
            borderTop: "1px solid #d1d5db",
            marginTop: 10,
            paddingTop: 6,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 8.5,
            color: "#6b7280",
          }}
        >
          <span>
            Generated:{" "}
            {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </span>
          <span>Class: {classLabel(className || report.student?.class, classCategory ?? report.student?.classCategory)}</span>
        </div>
        </div>
      </div>

      {/* Faint diagonal class-name watermark, shown ONCE, centered and
          layered on top of the whole card at very low opacity so it always
          shows regardless of which sections behind it have solid white
          fills (an earlier version placed it behind the content, which
          made it invisible under the Academic Performance table's opaque
          background). Shows the class name (previously the school name).
          Mirrors the identical single diagonal watermark drawn on every
          page of the PDF export — see diagonalWatermarkSvg() in
          backend/src/services/pdfService.js. */}
      <svg
        className="report-watermark-svg"
        viewBox="0 0 640 900"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "92%",
          maxWidth: 620,
          pointerEvents: "none",
        }}
      >
        <text
          x="320"
          y="450"
          fontSize="52"
          fontWeight="700"
          fill="#000000"
          fillOpacity="0.08"
          letterSpacing="2"
          textAnchor="middle"
          transform="rotate(-28 320 450)"
        >
          {watermarkText(className || report.student?.class)}
        </text>
      </svg>
    </div>
  );
}
