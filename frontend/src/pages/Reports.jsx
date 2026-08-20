import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useYear } from "../context/YearContext";
import ArchivedYearBanner from "../components/ArchivedYearBanner";
import ReportCardTable, { classLabel, letterGrade } from "../components/ReportCardTable";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Loader from "../components/ui/Loader";
import SearchInput from "../components/ui/SearchInput";
import RankBadge from "../components/ui/RankBadge";
import ScoreCell from "../components/ui/ScoreCell";
import { avatarColorFor, initialsFor } from "../utils/avatarColor";
import { averageBand } from "../utils/gradeBands";
import { Field, Select } from "../components/ui/FormField";
import { Eye, Lock, Unlock, MapPin, Printer, Files, AlertTriangle, Phone, Mail, Users, SearchX } from "lucide-react";


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
  const { viewingYearId, viewingYear, isCurrentView } = useYear();
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [classReport, setClassReport] = useState(null);
  const [loadingClassReport, setLoadingClassReport] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [viewingStudent, setViewingStudent] = useState(null); // { id, name } or null
  const [studentReport, setStudentReport] = useState(null);
  const [studentReportError, setStudentReportError] = useState("");
  const [studentReportErrorCode, setStudentReportErrorCode] = useState("");
  const [printJob, setPrintJob] = useState(null); // { reports: [...] } or null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    // Managers browse whichever year is selected in the header switcher;
    // teachers always work off the current year only (they have no
    // switcher, and the backend already scopes their own endpoints to it).
    if (user.role === "manager" && !viewingYearId) return;

    (async () => {
      const classesParams = user.role === "manager" ? { academicYearId: viewingYearId } : {};
      const [classesRes, yearsRes] = await Promise.all([
        api.get("/classes", { params: classesParams }),
        api.get("/academic-years"),
      ]);
      const visibleClasses =
        user.role === "teacher"
          ? classesRes.data.classes.filter((c) => c.classTeacher?.id === user.id)
          : classesRes.data.classes;
      setClasses(visibleClasses);
      setSelectedClassId(""); // the class picked in one year may not exist in another
      // Managers get the full picture of the viewed year's terms from the
      // year switcher's own data (it already fetched ?all=true with Terms
      // included); teachers keep the plain current-year-only fetch.
      setYears(user.role === "manager" ? (viewingYear ? [viewingYear] : []) : yearsRes.data.academicYears);
    })();
  }, [user, viewingYearId, viewingYear]);

  const currentYear = years.find((y) => y.isCurrent);
  const allTerms = years.flatMap((y) => (y.Terms || []).map((t) => ({ ...t, yearName: y.name, yearIsCurrent: y.isCurrent })));
  const selectedTerm = allTerms.find((t) => String(t.id) === selectedTermId);

  async function loadReport() {
    setError("");
    setErrorCode("");
    setSelectedIds(new Set());
    setStudentSearch("");
    if (!selectedClassId || !selectedTermId) {
      setClassReport(null);
      return;
    }
    setLoadingClassReport(true);
    try {
      const { data } = await api.get(`/classes/${selectedClassId}/term/${selectedTermId}/report`);
      setClassReport(data);
    } catch (err) {
      setClassReport(null);
      setError(err.message);
      setErrorCode(err.code || "");
    } finally {
      setLoadingClassReport(false);
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
    setSelectedIds((prev) => {
      // Selects/deselects only the currently visible (search-filtered)
      // rows, so a selection made before searching isn't silently wiped —
      // e.g. select all, search a name, select-all again only touches the
      // narrowed-down list.
      const visibleIds = filteredReports.map((r) => r.student.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const sortedReports = classReport
    ? [...classReport.reports].sort((a, b) => {
        const ar = a.classRank ?? Infinity;
        const br = b.classRank ?? Infinity;
        return ar - br;
      })
    : [];

  // Live search: filters the already-loaded class report client-side (no
  // extra request), by student name — matches as you type.
  const filteredReports = studentSearch.trim()
    ? sortedReports.filter((r) => r.student.name.toLowerCase().includes(studentSearch.trim().toLowerCase()))
    : sortedReports;

  // Selection is tracked against the full class list, not just the
  // filtered/visible one, so a student stays selected for printing even
  // after the search box is cleared or changed.
  const selectedReports = sortedReports.filter((r) => selectedIds.has(r.student.id));
  const allSelected =
    filteredReports.length > 0 && filteredReports.every((r) => selectedIds.has(r.student.id));

  function printSelected() {
    if (selectedReports.length === 0 || !classReport) return;
    const withSchoolInfo = selectedReports.map((r) => ({
      ...r,
      schoolName: classReport.schoolName,
      schoolAddress: classReport.schoolAddress,
      schoolEmail: classReport.schoolEmail,
      schoolPhone: classReport.schoolPhone,
      schoolLogoUrl: classReport.schoolLogoUrl,
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
      {user.role === "manager" && <ArchivedYearBanner />}
      <Card>
        <div className="flex items-end gap-4 flex-wrap">
          <Field label="Class" className="min-w-[180px] flex-1 sm:flex-none">
            <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.category ? `(${c.category})` : ""}
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
          {user.role === "manager" && viewingYear && (
            <Badge tone={isCurrentView ? "manager" : "warning"}>
              {isCurrentView ? "Active Academic Year: " : "Viewing (archived): "}
              {viewingYear.name}
            </Badge>
          )}
          {user.role !== "manager" && currentYear && (
            <Badge tone="manager">Active Academic Year: {currentYear.name}</Badge>
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

      {/* First load for this class/term (no report on screen yet) — show a
          full, centered loader instead of an empty gap. */}
      {loadingClassReport && !classReport && !error && (
        <Card>
          <Loader label="Loading class report…" />
        </Card>
      )}

      {classReport && (
        <Card
          title={`${classLabel(classReport.className, classReport.classCategory)} — ${selectedTerm?.name}${
            selectedTerm?.yearName ? ` (${selectedTerm.yearName})` : ""
          }`}
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
            </div>
          }
        >
          {sortedReports.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p className="text-xs text-slate-400">
                Select students below to print their report card — select one for{" "}
                <span className="font-medium">Print</span>, or several for{" "}
                <span className="font-medium">Print All</span>.
              </p>
              <SearchInput
                value={studentSearch}
                onChange={setStudentSearch}
                placeholder="Search student…"
                className="w-full sm:w-64"
              />
            </div>
          )}
          <div className="overflow-x-auto relative rounded-xl border border-slate-200 shadow-sm">
            {/* Switching class/term while a report is already on screen —
                dim + blur the existing table and spin a compact loader on
                top of it, instead of yanking the data away and flashing an
                empty state. */}
            {loadingClassReport && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10">
                <Loader label="Updating report…" size="sm" className="py-0" />
              </div>
            )}
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-10">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none normal-case tracking-normal text-sm text-slate-600 font-medium">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all students"
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-500 accent-brand-500 cursor-pointer text-sm leading-none"
                      />
                      Select All
                    </label>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold">Student</th>
                  <th className="px-4 py-3 text-left font-semibold">Weighted Average</th>
                  <th className="px-4 py-3 text-left font-semibold">Grade</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={22} className="text-slate-300" />
                        <span className="text-sm">No students in this class.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {sortedReports.length > 0 && filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <SearchX size={22} className="text-slate-300" />
                        <span className="text-sm">
                          No students match <span className="font-medium text-slate-500">"{studentSearch}"</span>.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredReports.map((r) => {
                  const checked = selectedIds.has(r.student.id);
                  const avatar = avatarColorFor(r.student.name);
                  return (
                    <tr
                      key={r.student.id}
                      className={`border-t border-slate-100 transition-colors duration-150 ${
                        checked ? "bg-brand-50/60 hover:bg-brand-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(r.student.id)}
                          aria-label={`Select ${r.student.name}`}
                          className="h-4 w-4 rounded border-slate-300 text-brand-500 accent-brand-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <RankBadge rank={r.classRank} total={r.classRankTotal} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatar.bg} ${avatar.text}`}
                          >
                            {initialsFor(r.student.name)}
                          </span>
                          <span className="font-medium text-slate-800">{r.student.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <ScoreCell value={r.weightedAverage} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-sm font-semibold tabular-nums ${averageBand(r.weightedAverage).text}`}
                        >
                          {letterGrade(r.weightedAverage)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => openStudentReport(r.student)}>
                            <Eye size={14} /> View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          </>
        }
      >
        {studentReportError && (
          <ReportBlockedNotice message={studentReportError} code={studentReportErrorCode} compact />
        )}
        {!studentReport && !studentReportError && <Loader label="Loading report…" />}
        {studentReport && (
          <ReportCardTable
            report={studentReport}
            schoolName={studentReport.schoolName}
            schoolAddress={studentReport.schoolAddress}
            schoolEmail={studentReport.schoolEmail}
            schoolPhone={studentReport.schoolPhone}
            schoolLogoUrl={studentReport.schoolLogoUrl}
            className={classReport?.className}
            classCategory={studentReport.classCategory ?? classReport?.classCategory}
            termName={selectedTerm?.name}
          />
        )}
      </Modal>

      {/* Hidden except when printing — see index.css (#print-root).
          Portaled to document.body (a sibling of #root) instead of being
          rendered in place here, deep inside the normal page layout. Why:
          the print CSS hides everything with visibility:hidden, but
          visibility:hidden keeps an element's box HEIGHT in the page flow
          — it just makes it invisible. So the hidden dashboard underneath
          (sidebar, filters, the full class table, etc.) was still
          contributing its full height to the printed document, and the
          browser paginated that hidden height into extra blank pages
          after the one real report-card page. Portaling #print-root out to
          <body> lets the print stylesheet collapse #root entirely with
          display:none (which removes it from layout, not just hides it)
          while #print-root — now #root's sibling, unaffected by that rule
          — prints cleanly with no leftover blank pages. */}
      {createPortal(
        <div id="print-root">
          {printJob?.reports.map((r) => (
            <div className="report-page" key={r.student.id}>
              <ReportCardTable
                report={r}
                schoolName={r.schoolName || classReport?.schoolName}
                schoolAddress={r.schoolAddress || classReport?.schoolAddress}
                schoolEmail={r.schoolEmail || classReport?.schoolEmail}
                schoolPhone={r.schoolPhone || classReport?.schoolPhone}
                schoolLogoUrl={r.schoolLogoUrl || classReport?.schoolLogoUrl}
                className={classReport?.className}
                classCategory={r.student?.classCategory ?? classReport?.classCategory}
                termName={selectedTerm?.name}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
