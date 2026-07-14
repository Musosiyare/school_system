import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Field, Select } from "../components/ui/FormField";
import { EmptyRow } from "../components/ui/Table";
import { useNotify } from "../components/ui/NotifyProvider";
import { Download, Eye, Lock, Unlock, MapPin, Printer, Files, GraduationCap, AlertTriangle, Phone, Mail } from "lucide-react";

// PASS/FAIL is displayed using competency-based terminology: C (Competent) /
// NYC (Not Yet Competent). Each module's decision comes only from that
// module's own pass mark (never the weight), exactly as the backend already
// computes `status`.
function toDecision(word) {
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

// Watermark shows the FULL school name (no longer abbreviated to just the
// first word). Mirrors watermarkText() in
// backend/src/services/pdfService.js so the on-screen/print watermark and
// the PDF watermark always show the same text.
function watermarkText(schoolName) {
  return (schoolName || "School").trim().toUpperCase();
}



const th = { textAlign: "left" };
const center = { textAlign: "center" };

// The report card as a set of distinct sections — colored banner, student
// panel, academic performance table, comments & summary, signatures —
// matching the layout generated server-side for the PDF download (see
// backend/src/services/pdfService.js) and the reference template. Used on
// screen and for browser print.
// Black-and-white only: report cards are printed on B&W printers, so no
// background fills or colored text anywhere — everything below resolves to
// white backgrounds, black text, and black borders for section separation.
const BRAND_BLUE = "#000000";
const BRAND_BLUE_LIGHT = "#ffffff";
const PANEL_GREY = "#ffffff";

function SectionLabel({ children }) {
  return (
    <div
      className="report-section-label"
      style={{
        background: BRAND_BLUE_LIGHT,
        color: BRAND_BLUE,
        fontWeight: 700,
        fontSize: 11,
        padding: "6px 10px",
        margin: "10px 0 8px",
      }}
    >
      {children}
    </div>
  );
}

function ReportCardTable({ report, schoolName, schoolAddress, schoolEmail, schoolPhone, className, termName }) {
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
      style={{ border: "1.5px solid #000", padding: "14px 14px 90px", position: "relative" }}
    >
      {/* Banner: centered title/term on top, then school (left) and
          labeled student details (right) below — mirrors the PDF's
          letterhead() layout. Every line uses the same font size. */}
      <div className="report-avoid-break" style={{ padding: "10px 14px", marginBottom: 10 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>MID-TERM REPORT CARD</div>
          <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{termName || report.term}</div>
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
              Class: {className || report.student?.class || "-"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>
              Student ID: {report.student?.admissionNumber || "-"}
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>ACADEMIC PERFORMANCE</SectionLabel>

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
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "8px 6px" }}>Weight</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "8px 6px" }}>Score</th>
            <th style={{ ...center, whiteSpace: "nowrap", fontSize: 11, padding: "8px 6px" }}>Decision</th>
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
                    padding: "8px 5px",
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
              <td style={{ fontWeight: 700, whiteSpace: "nowrap", padding: "8px 10px" }}>{m.code || "-"}</td>
              <td>{m.title}</td>
              <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 6px" }}>{m.weight}</td>
              <td
                style={{
                  ...center,
                  fontWeight: m.score === null ? 700 : 400,
                  whiteSpace: "nowrap",
                  padding: "8px 6px",
                }}
              >
                {m.score === null ? "N/A" : m.score}
              </td>
              <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 6px" }}>
                {toDecision(m.status)}
              </td>
            </tr>
          ))}
          <tr className="report-avoid-break">
            <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>
              TOTAL
            </td>
            <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 6px" }}>
              {report.modules.reduce((sum, m) => sum + (m.weight || 0), 0)}
            </td>
            <td style={{ ...center, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 6px" }}>
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

      {/* Signatures + footer are wrapped together and pinned with
          `position: absolute; bottom: 14` inside the card (which is
          `position: relative` — see the outer div below). Anchoring it to
          the card's own bottom edge, instead of just letting it sit
          wherever normal document flow happens to end, is what stops it
          from being pushed to a second page: its vertical position no
          longer depends on how tall the content above it turned out to be,
          so there's never a "not quite enough room left" gap for the
          browser to shove it into on its own page. Combined with
          .report-card-page's print-only min-height of one A4 page (see
          index.css), bottom:14 always lands at the true bottom of the
          printed page. The card's own bottom padding (see
          .report-card-page below) is widened to keep the table/summary
          content from visually running into this reserved area. */}
      <div
        className="report-avoid-break"
        style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}
      >
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
            <div style={{ fontWeight: 700, fontSize: 11 }}>{report.student?.guardianName || "Not assigned"}</div>
            <div style={{ fontSize: 8, color: "#000" }}>PARENT/GUARDIAN</div>
          </div>
        </div>

        {/* Footer: generated date + class name, replacing the per-signature
            date lines. Intentionally kept a lighter gray — this is a print
            timestamp, not report content. */}
        <div
          style={{
            borderTop: "1px solid #d1d5db",
            marginTop: 16,
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
          <span>Class: {className || report.student?.class || "-"}</span>
        </div>
      </div>

      {/* Faint diagonal school-name watermark, shown ONCE, centered and
          layered on top of the whole card at very low opacity so it always
          shows regardless of which sections behind it have solid white
          fills (an earlier version placed it behind the content, which
          made it invisible under the Academic Performance table's opaque
          background). Shows the FULL school name (previously only the
          first word was shown). Mirrors the identical single diagonal
          watermark drawn on every page of the PDF export — see
          diagonalWatermarkSvg() in backend/src/services/pdfService.js. */}
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
          {watermarkText(schoolName)}
        </text>
      </svg>
    </div>
  );
}


// A clear, intentional block for "can't show this report" states — used
// both under the class/term picker and inside the single-student view
// modal. Distinguishes the specific "term locked, ask the head teacher"
// case (Lock icon, red) from any other/unexpected error (warning icon,
// amber), instead of a plain line of red text.
function ReportBlockedNotice({ message, code, compact }) {
  const restricted = code === "REPORTS_DISABLED";
  const Icon = restricted ? Lock : AlertTriangle;
  return (
    <div
      className={`flex flex-col items-center text-center gap-2 rounded-xl border ${
        restricted ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      } ${compact ? "py-6 px-4" : "py-10 px-6"}`}
    >
      <div className={`rounded-full p-2.5 ${restricted ? "bg-red-100" : "bg-amber-100"}`}>
        <Icon className={restricted ? "text-red-600" : "text-amber-600"} size={22} />
      </div>
      <p className={`font-semibold ${restricted ? "text-red-700" : "text-amber-700"}`}>
        {restricted ? "Report Temporarily Disabled" : "Couldn't load report"}
      </p>
      <p className="text-sm text-slate-500 max-w-sm">{message}</p>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const notify = useNotify();
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [classReport, setClassReport] = useState(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [viewingStudent, setViewingStudent] = useState(null); // { id, name } or null
  const [studentReport, setStudentReport] = useState(null);
  const [studentReportError, setStudentReportError] = useState("");
  const [studentReportErrorCode, setStudentReportErrorCode] = useState("");
  const [printJob, setPrintJob] = useState(null); // { reports: [...] } or null
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    (async () => {
      const [classesRes, yearsRes] = await Promise.all([
        api.get("/classes"),
        api.get("/academic-years"),
      ]);
      const visibleClasses =
        user.role === "teacher"
          ? classesRes.data.classes.filter((c) => c.classTeacher?.id === user.id)
          : classesRes.data.classes;
      setClasses(visibleClasses);
      setYears(yearsRes.data.academicYears);
    })();
  }, [user]);

  const currentYear = years.find((y) => y.isCurrent);
  const allTerms = years.flatMap((y) => (y.Terms || []).map((t) => ({ ...t, yearName: y.name, yearIsCurrent: y.isCurrent })));
  const selectedTerm = allTerms.find((t) => String(t.id) === selectedTermId);

  async function loadReport() {
    setError("");
    setErrorCode("");
    setSelectedIds(new Set());
    if (!selectedClassId || !selectedTermId) {
      setClassReport(null);
      return;
    }
    try {
      const { data } = await api.get(`/classes/${selectedClassId}/term/${selectedTermId}/report`);
      setClassReport(data);
    } catch (err) {
      setClassReport(null);
      setError(err.message);
      setErrorCode(err.code || "");
    }
  }

  // Real-time: the report loads the moment both a class and a term are picked,
  // and reloads automatically if either selection changes — no "Load Report"
  // click required.
  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedTermId]);

  async function openStudentReport(student) {
    setViewingStudent(student);
    setStudentReport(null);
    setStudentReportError("");
    setStudentReportErrorCode("");
    try {
      const { data } = await api.get(`/students/${student.id}/term/${selectedTermId}/report`);
      setStudentReport(data.report);
    } catch (err) {
      setStudentReportError(err.message);
      setStudentReportErrorCode(err.code || "");
    }
  }

  async function downloadPdf(url, filename) {
    const token = localStorage.getItem("token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // Backend sends { error: { code, message } } JSON on failure (e.g.
      // reports temporarily disabled for this term) — surface that message
      // instead of silently downloading a broken/corrupt file.
      let message = "Something went wrong while downloading the report.";
      let code;
      try {
        const data = await res.json();
        message = data?.error?.message || message;
        code = data?.error?.code;
      } catch {
        // ignore parse failure, fall back to default message
      }
      const restricted = code === "REPORTS_DISABLED";
      notify({
        title: restricted ? "Report unavailable" : "Download failed",
        message,
        tone: restricted ? "restricted" : "error",
      });
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  // Printing renders the requested report card(s) into the hidden #print-root
  // (see index.css) and then opens the browser print dialog once painted.
  useEffect(() => {
    if (!printJob) return;
    const t = setTimeout(() => window.print(), 60);
    return () => clearTimeout(t);
  }, [printJob]);

  useEffect(() => {
    function clearJob() {
      setPrintJob(null);
    }
    window.addEventListener("afterprint", clearJob);
    return () => window.removeEventListener("afterprint", clearJob);
  }, []);

  function toggleSelect(studentId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!classReport) return;
    setSelectedIds((prev) =>
      prev.size === sortedReports.length ? new Set() : new Set(sortedReports.map((r) => r.student.id))
    );
  }

  const sortedReports = classReport
    ? [...classReport.reports].sort((a, b) => {
        const ar = a.classRank ?? Infinity;
        const br = b.classRank ?? Infinity;
        return ar - br;
      })
    : [];

  const selectedReports = sortedReports.filter((r) => selectedIds.has(r.student.id));
  const allSelected = sortedReports.length > 0 && selectedIds.size === sortedReports.length;

  function printSelected() {
    if (selectedReports.length === 0 || !classReport) return;
    const withSchoolInfo = selectedReports.map((r) => ({
      ...r,
      schoolName: classReport.schoolName,
      schoolAddress: classReport.schoolAddress,
      schoolEmail: classReport.schoolEmail,
      schoolPhone: classReport.schoolPhone,
      schoolManagerName: classReport.schoolManagerName,
    }));
    setPrintJob({ reports: withSchoolInfo });
  }

  function printFromModal() {
    if (!studentReport) return;
    setPrintJob({ reports: [studentReport] });
  }

  return (
    <div>
      <Card>
        <div className="flex items-end gap-4 flex-wrap">
          <Field label="Class" className="min-w-[180px] flex-1 sm:flex-none">
            <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term" className="min-w-[260px] flex-1 sm:flex-none">
            <div className="flex flex-wrap gap-2">
              {allTerms.length === 0 && (
                <span className="text-sm text-slate-400 py-2">No terms available</span>
              )}
              {allTerms.map((t) => {
                const active = String(t.id) === selectedTermId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTermId(String(t.id))}
                    aria-pressed={active}
                    title={`Academic Year: ${t.yearName}${t.yearIsCurrent ? " (current)" : ""}`}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm transition ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t.name}
                    {t.isLocked ? (
                      <Lock size={13} className="text-red-600" />
                    ) : (
                      <Unlock size={13} className="text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>
          {currentYear && (
            <Badge tone="manager">Current Academic Year: {currentYear.name}</Badge>
          )}
          {selectedTerm?.isLocked && (
            <Badge tone="warning">This term is locked — marks can no longer be edited</Badge>
          )}
          {selectedTerm?.isLocked && (
            <Badge tone="fail">
              Reports for this term are temporarily disabled
              {user.role !== "manager" ? " — ask the head teacher to view them" : " (visible to you as head teacher)"}
            </Badge>
          )}
        </div>
        {selectedTerm && (
          <p className="text-xs text-slate-500 mt-3">
            Selected term <span className="font-medium text-slate-700">{selectedTerm.name}</span> belongs to
            academic year <span className="font-medium text-slate-700">{selectedTerm.yearName}</span>
            {selectedTerm.yearIsCurrent ? (
              <span className="text-emerald-600 font-medium"> — this is the current academic year</span>
            ) : (
              <span className="text-amber-600 font-medium"> — not the current academic year</span>
            )}
            .
          </p>
        )}
        {years.length === 0 && (
          <p className="text-xs text-amber-600 mt-3">
            No current academic year has been set by the school manager yet, so no terms are
            available.
          </p>
        )}
        {/* Reports load automatically as soon as a class and term are picked. */}
      </Card>

      {error && (
        <Card>
          <ReportBlockedNotice message={error} code={errorCode} />
        </Card>
      )}

      {classReport && (
        <Card
          title={`${classReport.className} — ${selectedTerm?.name}`}
          subtitle={
            <>
              Class Teacher: {classReport.reports[0]?.classTeacherName || "Not assigned"} · School
              Manager: {classReport.schoolManagerName || "Not assigned"}
              {classReport.schoolAddress && (
                <span className="flex items-center gap-1 mt-1 text-slate-400">
                  <MapPin size={12} /> {classReport.schoolAddress}
                </span>
              )}
              {(classReport.schoolPhone || classReport.schoolEmail) && (
                <span className="flex items-center gap-3 mt-1 text-slate-400">
                  {classReport.schoolPhone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {classReport.schoolPhone}
                    </span>
                  )}
                  {classReport.schoolEmail && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {classReport.schoolEmail}
                    </span>
                  )}
                </span>
              )}
            </>
          }
          actions={
            <div className="flex gap-2 flex-wrap justify-end items-center">
              {selectedReports.length === 1 && (
                <Button size="sm" variant="secondary" onClick={printSelected}>
                  <Printer size={14} /> Print
                </Button>
              )}
              {selectedReports.length > 1 && (
                <Button size="sm" variant="secondary" onClick={printSelected}>
                  <Files size={14} /> Print All
                </Button>
              )}
              <Button
                size="sm"
                variant="teal"
                disabled={sortedReports.length === 0}
                title={sortedReports.length === 0 ? "No students in this class" : undefined}
                onClick={() =>
                  downloadPdf(
                    `${api.defaults.baseURL}/classes/${selectedClassId}/term/${selectedTermId}/report/pdf`,
                    `class-report-${selectedClassId}-term${selectedTermId}.pdf`
                  )
                }
              >
                <Download size={14} /> Download Class PDF
              </Button>
            </div>
          }
        >
          {sortedReports.length > 0 && (
            <p className="text-xs text-slate-400 mb-2">
              Select students below to print their report card — select one for{" "}
              <span className="font-medium">Print</span>, or several for{" "}
              <span className="font-medium">Print All</span>.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all students"
                    />
                  </th>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Weighted Average</th>
                  <th>Decision</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.length === 0 && <EmptyRow colSpan={6}>No students in this class.</EmptyRow>}
                {sortedReports.map((r) => (
                  <tr key={r.student.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.student.id)}
                        onChange={() => toggleSelect(r.student.id)}
                        aria-label={`Select ${r.student.name}`}
                      />
                    </td>
                    <td className="tabular-nums">
                      {r.classRank != null && r.classRankTotal ? `${r.classRank} / ${r.classRankTotal}` : "-"}
                    </td>
                    <td>{r.student.name}</td>
                    <td className="tabular-nums">{r.weightedAverage !== null ? `${r.weightedAverage}%` : "N/A"}</td>
                    <td>
                      <span
                        className={`font-medium ${
                          r.overallResult === "PASS"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {toDecision(r.overallResult)}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => openStudentReport(r.student)}>
                          <Eye size={14} /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="teal"
                          onClick={() =>
                            downloadPdf(
                              `${api.defaults.baseURL}/students/${r.student.id}/term/${selectedTermId}/report/pdf`,
                              `report-${r.student.id}-term${selectedTermId}.pdf`
                            )
                          }
                        >
                          <Download size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        title={viewingStudent ? `${viewingStudent.name} — ${selectedTerm?.name}` : ""}
        size="full"
        footer={
          <>
            <Button variant="ghost" onClick={() => setViewingStudent(null)}>
              Close
            </Button>
            {viewingStudent && studentReport && (
              <Button variant="secondary" onClick={printFromModal}>
                <Printer size={14} /> Print
              </Button>
            )}
            {viewingStudent && studentReport && (
              <Button
                variant="teal"
                onClick={() =>
                  downloadPdf(
                    `${api.defaults.baseURL}/students/${viewingStudent.id}/term/${selectedTermId}/report/pdf`,
                    `report-${viewingStudent.id}-term${selectedTermId}.pdf`
                  )
                }
              >
                <Download size={14} /> Download PDF
              </Button>
            )}
          </>
        }
      >
        {studentReportError && (
          <ReportBlockedNotice message={studentReportError} code={studentReportErrorCode} compact />
        )}
        {!studentReport && !studentReportError && (
          <p className="text-sm text-slate-400 py-6 text-center">Loading report…</p>
        )}
        {studentReport && (
          <div className="overflow-x-auto">
            <ReportCardTable
              report={studentReport}
              schoolName={studentReport.schoolName}
              schoolAddress={studentReport.schoolAddress}
              schoolEmail={studentReport.schoolEmail}
              schoolPhone={studentReport.schoolPhone}
              className={classReport?.className}
              termName={selectedTerm?.name}
            />
          </div>
        )}
      </Modal>

      {/* Hidden except when printing — see index.css (#print-root). */}
      <div id="print-root">
        {printJob?.reports.map((r) => (
          <div className="report-page" key={r.student.id}>
            <ReportCardTable
              report={r}
              schoolName={r.schoolName || classReport?.schoolName}
              schoolAddress={r.schoolAddress || classReport?.schoolAddress}
              schoolEmail={r.schoolEmail || classReport?.schoolEmail}
              schoolPhone={r.schoolPhone || classReport?.schoolPhone}
              className={classReport?.className}
              termName={selectedTerm?.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
