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

// Each Overall Result grade gets its own color so it stands out at a
// glance — mirrors overallGradeColor() in backend/src/services/pdfService.js.
function overallGradeColor(weightedAverage) {
  const grade = overallGrade(weightedAverage);
  if (grade === "EXCELLENT") return "#1f7a4d"; // green
  if (grade === "VERY GOOD") return "#1d4ed8"; // blue
  if (grade === "PASS") return "#b45309"; // amber
  if (grade === "FAIL") return "#b3403a"; // red
  return "#6b7280"; // N/A — gray
}

// Watermark shows the class name (previously the school name). Mirrors
// watermarkText() in backend/src/services/pdfService.js so the on-screen/
// print watermark and the PDF watermark always show the same text.
function watermarkText(className) {
  return (className || "Class").trim().toUpperCase();
}

const th = { textAlign: "left" };
const center = { textAlign: "center" };

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
  className,
  classCategory,
  termName,
}) {
  const contactLine = [schoolPhone, schoolEmail].filter(Boolean).join("  ·  ");
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
            <GraduationCap size={40} color="#0a1f44" style={{ marginBottom: 4 }} />
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
              Class: {classLabel(className || report.student?.class, classCategory ?? report.student?.classCategory)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>
              Student ID: {report.student?.admissionNumber || "-"}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel color={SECTION_TITLE_COLOR} fontSize={14}>ACADEMIC PERFORMANCE</SectionLabel>

      <table className="report-table report-avoid-break" style={{ marginBottom: 4, tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "16%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "38%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...center, whiteSpace: "nowrap" }}>Module Type</th>
            <th style={{ ...th, whiteSpace: "nowrap" }}>Code</th>
            <th style={th}>Module Name</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "3px 6px" }}>Weight</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "3px 6px" }}>Score</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "3px 6px" }}>Decision</th>
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
                  <div style={{ fontWeight: 700, fontSize: 11, textTransform: "capitalize", lineHeight: 1.2 }}>
                    {m.type || "general"}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 400, marginTop: 3, lineHeight: 1.2 }}>
                    Passing line {(m.type || "general") === "specific" ? 70 : 50}%
                  </div>
                </td>
              )}
              <td style={{ fontWeight: 700, whiteSpace: "nowrap", padding: "3px 8px" }}>{m.code || "-"}</td>
              <td>{m.title}</td>
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
            <th style={{ ...center, fontSize: 9, color: "#000", border: "none" }}>CLASS RANK</th>
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
                color: overallGradeColor(report.weightedAverage),
              }}
            >
              {overallGrade(report.weightedAverage)}
            </td>
            <td style={{ ...center, fontWeight: 700, fontSize: report.classRankTotal ? 10 : 12, border: "none" }}>
              {report.classRank != null && report.classRankTotal
                ? `${report.classRank} out of ${report.classRankTotal}`
                : "N/A"}
            </td>
          </tr>
        </tbody>
      </table>

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
