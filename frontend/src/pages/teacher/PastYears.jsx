import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Field, Select } from "../../components/ui/FormField";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import ReportCardTable, { classLabel, toDecision } from "../../components/ReportCardTable";
import {
  CalendarClock,
  Lock,
  Eye,
  AlertTriangle,
  GraduationCap,
  FileText,
  ClipboardList,
} from "lucide-react";

// Read-only history for a teacher: pick an old academic year, then use the
// Report / Marks tabs below to look back at what happened that year —
// Report shows the class you led (class teachers only), Marks shows what
// you personally recorded for a module/class in "My Modules" (every
// teacher, class teacher or not). Same report card layout the "Reports"
// page uses. Nothing on this page ever writes anything — the backend
// already refuses any write against a non-current year, so this page
// simply never shows a way to try. It's the teacher-side counterpart to
// the manager's year switcher (YearContext/YearSwitcher), scoped down to
// "my own history, view only" instead of "browse everything".
export default function PastYears() {
  const { user } = useAuth();

  const [years, setYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [selectedYearId, setSelectedYearId] = useState("");

  // "report" or "marks" — which card is on screen. A non-class-teacher for
  // the selected year never gets a "Report" tab at all (see the
  // classes-loading effect below), so this only ever lands on "report"
  // when there's actually a class to show.
  const [activeTab, setActiveTab] = useState("marks");

  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [selectedTermId, setSelectedTermId] = useState("");
  const [classReport, setClassReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  const [viewingStudent, setViewingStudent] = useState(null); // { id, name } or null
  const [studentReport, setStudentReport] = useState(null);
  const [studentReportError, setStudentReportError] = useState("");

  // --- "My Modules" section: marks for a module/class the teacher taught in
  // the selected past year, term by term. Works for every teacher, not just
  // whoever was the class teacher — a subject teacher who never held a class
  // still gets to look back at what they recorded. ---
  const [modAssignments, setModAssignments] = useState([]);
  const [loadingModAssignments, setLoadingModAssignments] = useState(false);
  const [selectedModAssignmentId, setSelectedModAssignmentId] = useState("");
  const [selectedModTermId, setSelectedModTermId] = useState("");
  const [modRoster, setModRoster] = useState([]);
  const [modMarks, setModMarks] = useState([]);
  const [loadingModMarks, setLoadingModMarks] = useState(false);
  const [modError, setModError] = useState("");

  // Only past (non-current) years belong here — the current year already
  // has its own live "Reports" page.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/academic-years", { params: { all: true } });
        const past = (data.academicYears || []).filter((y) => !y.isCurrent);
        setYears(past);
        if (past.length > 0) setSelectedYearId(String(past[0].id));
      } finally {
        setLoadingYears(false);
      }
    })();
  }, []);

  // Whichever class(es) this teacher was the class teacher of, in the
  // selected year specifically — a teacher's class assignment can change
  // year to year, so this is re-fetched every time the year changes. A
  // teacher who wasn't a class teacher that year has nothing to show on a
  // "Report" tab, so it's dropped in favor of "Marks" the moment that
  // becomes clear.
  useEffect(() => {
    if (!selectedYearId) {
      setClasses([]);
      setSelectedClassId("");
      return;
    }
    setLoadingClasses(true);
    setClassReport(null);
    setSelectedTermId("");
    (async () => {
      try {
        const { data } = await api.get("/classes", { params: { academicYearId: selectedYearId } });
        const owned = (data.classes || []).filter((c) => c.classTeacher?.id === user.id);
        setClasses(owned);
        setSelectedClassId(owned.length > 0 ? String(owned[0].id) : "");
        setActiveTab(owned.length > 0 ? "report" : "marks");
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, [selectedYearId, user.id]);

  const selectedYear = years.find((y) => String(y.id) === selectedYearId);
  const terms = selectedYear?.Terms || [];
  const selectedTerm = terms.find((t) => String(t.id) === selectedTermId);
  const isClassTeacherThisYear = classes.length > 0;

  // Every module/class this teacher taught in the selected year — regardless
  // of whether they were the class teacher — so subject teachers get a "My
  // Modules" picker here the same way class teachers get a class picker
  // above.
  useEffect(() => {
    setSelectedModAssignmentId("");
    setSelectedModTermId("");
    setModRoster([]);
    setModMarks([]);
    setModError("");
    if (!selectedYearId) {
      setModAssignments([]);
      return;
    }
    setLoadingModAssignments(true);
    (async () => {
      try {
        const { data } = await api.get(`/teachers/${user.id}/assignments`, {
          params: { academicYearId: selectedYearId },
        });
        setModAssignments(data.assignments || []);
      } finally {
        setLoadingModAssignments(false);
      }
    })();
  }, [selectedYearId, user.id]);

  const selectedModAssignment = modAssignments.find(
    (a) => String(a.id) === selectedModAssignmentId
  );
  const selectedModTerm = terms.find((t) => String(t.id) === selectedModTermId);

  useEffect(() => {
    setModError("");
    setModRoster([]);
    setModMarks([]);
    if (!selectedModAssignment || !selectedModTermId) return;
    // Same treatment as the Report tab — a locked term shows its own
    // dedicated message instead (see the "Marks" tab render below), so
    // there's no reason to load the roster/marks behind it.
    if (selectedModTerm?.isLocked) return;
    setLoadingModMarks(true);
    (async () => {
      try {
        const [rosterRes, marksRes] = await Promise.all([
          api.get(`/classes/${selectedModAssignment.classId}/students`),
          api.get("/marks", {
            params: {
              classId: selectedModAssignment.classId,
              moduleId: selectedModAssignment.moduleId,
              termId: selectedModTermId,
            },
          }),
        ]);
        setModRoster(rosterRes.data.students || []);
        setModMarks(marksRes.data.marks || []);
      } catch (err) {
        setModError(err.message);
      } finally {
        setLoadingModMarks(false);
      }
    })();
  }, [selectedModAssignment?.classId, selectedModAssignment?.moduleId, selectedModTermId, selectedModTerm?.isLocked]);

  const modScoreByStudent = Object.fromEntries(modMarks.map((m) => [m.studentId, m.score]));

  useEffect(() => {
    setError("");
    setClassReport(null);
    if (!selectedClassId || !selectedTermId) return;
    // A locked term gets its own dedicated message instead (see the
    // "Report" tab render below) — no need to hit the backend, which would
    // refuse it for a non-manager anyway.
    if (selectedTerm?.isLocked) return;
    setLoadingReport(true);
    (async () => {
      try {
        const { data } = await api.get(`/classes/${selectedClassId}/term/${selectedTermId}/report`);
        setClassReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingReport(false);
      }
    })();
  }, [selectedClassId, selectedTermId, selectedTerm?.isLocked]);

  async function openStudentReport(student) {
    setViewingStudent(student);
    setStudentReport(null);
    setStudentReportError("");
    try {
      const { data } = await api.get(`/students/${student.id}/term/${selectedTermId}/report`);
      setStudentReport(data.report);
    } catch (err) {
      setStudentReportError(err.message);
    }
  }

  const sortedReports = classReport
    ? [...classReport.reports].sort((a, b) => (a.classRank ?? Infinity) - (b.classRank ?? Infinity))
    : [];

  return (
    <div>
      <Card>
        <div className="flex items-center gap-2 mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
          <Lock size={15} className="shrink-0" />
          Past years are read-only. Nothing here can be edited — marks and remarks stay exactly as
          they were left when the year ended.
        </div>

        {loadingYears ? (
          <p className="text-sm text-slate-400 py-4 text-center">Loading academic years…</p>
        ) : years.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <CalendarClock className="text-slate-300" size={28} />
            <p className="text-sm text-slate-500">
              There's no past academic year yet — this page fills in once your school moves on from
              its first year.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-4 flex-wrap">
              <Field label="Academic Year" className="min-w-[200px] flex-1 sm:flex-none">
                <Select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedYear && (
                <Badge tone="warning">
                  <CalendarClock size={12} /> Viewing (archived): {selectedYear.name}
                </Badge>
              )}
            </div>

            {/* Report / Marks tabs. A teacher who wasn't the class teacher
                for this year never sees a "Report" tab — there's no class of
                theirs to report on — only "Marks", for whatever module(s)
                they taught. */}
            {!loadingClasses && (
              <div className="flex gap-2 mt-5 border-b border-slate-200">
                {isClassTeacherThisYear && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("report")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                      activeTab === "report"
                        ? "border-brand-500 text-brand-700"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FileText size={15} /> Report
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("marks")}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                    activeTab === "marks"
                      ? "border-brand-500 text-brand-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ClipboardList size={15} /> Marks
                </button>
              </div>
            )}

            {!loadingClasses && !isClassTeacherThisYear && (
              <p className="text-xs text-slate-400 mt-3">
                You weren't the class teacher of any class in {selectedYear?.name || "this year"} —
                showing your recorded marks instead.
              </p>
            )}
          </>
        )}
      </Card>

      {activeTab === "report" && isClassTeacherThisYear && (
        <Card
          title="Class Report"
          subtitle="The class you led that year, term by term."
        >
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Class" className="min-w-[180px] flex-1 sm:flex-none">
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={loadingClasses || classes.length === 0}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.category ? `(${c.category})` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Term" className="min-w-[220px] flex-1 sm:flex-none">
              <div className="flex flex-wrap gap-2">
                {terms.length === 0 && <span className="text-sm text-slate-400 py-2">No terms</span>}
                {terms.map((t) => {
                  const active = String(t.id) === selectedTermId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTermId(String(t.id))}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm transition ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t.isLocked && <Lock size={11} />}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {/* Locked term: this is the ONLY thing shown for it — no error card,
          no loading text, no table underneath. Same treatment as a locked
          term elsewhere in the app (e.g. Marks Entry) — one clear message,
          nothing else competing for attention. */}
      {activeTab === "report" && isClassTeacherThisYear && selectedClassId && selectedTermId && selectedTerm?.isLocked && (
        <Card>
          <div className="flex flex-col items-center text-center gap-3 py-12 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Lock size={26} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">{selectedTerm.name} is locked</h3>
            <p className="text-sm text-slate-500 max-w-md">
              This term was locked by the school manager, so its report card can't be viewed here —
              marks and remarks stay exactly as they were left when it closed.
            </p>
          </div>
        </Card>
      )}

      {activeTab === "report" && isClassTeacherThisYear && !selectedTerm?.isLocked && error && (
        <Card>
          <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-8 px-6">
            <AlertTriangle className="text-amber-600" size={22} />
            <p className="text-sm text-slate-500 max-w-sm">{error}</p>
          </div>
        </Card>
      )}

      {activeTab === "report" && isClassTeacherThisYear && !selectedTerm?.isLocked && loadingReport && (
        <Card>
          <p className="text-sm text-slate-400 py-4 text-center">Loading report…</p>
        </Card>
      )}

      {activeTab === "report" && isClassTeacherThisYear && !selectedTerm?.isLocked && classReport && !loadingReport && (
        <Card
          title={`${classLabel(classReport.className, classReport.classCategory)} — ${selectedTerm?.name} (${selectedYear?.name})`}
          subtitle={`Class Teacher: ${classReport.reports[0]?.classTeacherName || "Not assigned"} · School Manager: ${classReport.schoolManagerName || "Not assigned"}`}
        >
          <Table>
            <Thead>
              <tr>
                <Th>Rank</Th>
                <Th>Student</Th>
                <Th>Weighted Average</Th>
                <Th>Decision</Th>
                <Th className="text-right">Report Card</Th>
              </tr>
            </Thead>
            <tbody>
              {sortedReports.length === 0 && <EmptyRow colSpan={5}>No students in this class.</EmptyRow>}
              {sortedReports.map((r) => (
                <tr key={r.student.id}>
                  <Td>{r.classRank ? `${r.classRank} / ${r.classRankTotal}` : "-"}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <GraduationCap size={14} className="text-slate-300 shrink-0" />
                      {r.student.name}
                    </div>
                  </Td>
                  <Td>{r.weightedAverage !== null && r.weightedAverage !== undefined ? `${r.weightedAverage}%` : "N/A"}</Td>
                  <Td>
                    <span
                      className={`font-medium ${r.overallResult === "PASS" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {toDecision(r.overallResult)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openStudentReport(r.student)}>
                      <Eye size={13} /> View
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {activeTab === "marks" && years.length > 0 && (
        <Card
          title="My Modules"
          subtitle="Marks you recorded for a module/class in the selected year, term by term."
        >
          {!selectedYearId ? (
            <p className="text-sm text-slate-400 py-2">Pick an academic year above first.</p>
          ) : loadingModAssignments ? (
            <p className="text-sm text-slate-400 py-4 text-center">Loading your modules…</p>
          ) : modAssignments.length === 0 ? (
            <p className="text-xs text-slate-400">
              You weren't assigned to any module in {selectedYear?.name || "this year"}.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-4 flex-wrap">
                <Field label="Module / Class" className="min-w-[240px] flex-1 sm:flex-none">
                  <Select
                    value={selectedModAssignmentId}
                    onChange={(e) => {
                      setSelectedModAssignmentId(e.target.value);
                      setSelectedModTermId("");
                    }}
                  >
                    <option value="">Select a module</option>
                    {modAssignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.Module?.moduleTitle} — {a.Class?.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Term" className="min-w-[220px] flex-1 sm:flex-none">
                  <div className="flex flex-wrap gap-2">
                    {terms.length === 0 && <span className="text-sm text-slate-400 py-2">No terms</span>}
                    {terms.map((t) => {
                      const active = String(t.id) === selectedModTermId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={!selectedModAssignmentId}
                          onClick={() => setSelectedModTermId(String(t.id))}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            active
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {t.isLocked && <Lock size={11} />}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              {/* Locked term: this is the ONLY thing shown for it — no
                  error card, no loading text, no table underneath. Same
                  treatment as a locked term elsewhere in the app (e.g.
                  Marks Entry) — one clear message, nothing else competing
                  for attention. */}
              {selectedModAssignmentId && selectedModTermId && selectedModTerm?.isLocked && (
                <div className="flex flex-col items-center text-center gap-3 py-12 px-6 mt-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Lock size={26} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">{selectedModTerm.name} is locked</h3>
                  <p className="text-sm text-slate-500 max-w-md">
                    This term was locked by the school manager, so these marks can't be viewed here —
                    they stay exactly as they were left when it closed.
                  </p>
                </div>
              )}

              {!selectedModTerm?.isLocked && modError && (
                <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-6 px-4 mt-4">
                  <AlertTriangle className="text-amber-600" size={20} />
                  <p className="text-sm text-slate-500 max-w-sm">{modError}</p>
                </div>
              )}

              {!selectedModTerm?.isLocked && loadingModMarks && (
                <p className="text-sm text-slate-400 py-4 text-center">Loading marks…</p>
              )}

              {!selectedModTerm?.isLocked && !loadingModMarks && !modError && selectedModAssignment && selectedModTermId && (
                <div className="mt-4">
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Student</Th>
                        <Th>
                          Score (0-{selectedModAssignment.Module?.maxScore ?? 100})
                        </Th>
                        <Th>Status</Th>
                      </tr>
                    </Thead>
                    <tbody>
                      {modRoster.length === 0 && (
                        <EmptyRow colSpan={3}>No students in this class.</EmptyRow>
                      )}
                      {modRoster.map((s) => {
                        const score = modScoreByStudent[s.id];
                        const hasValue = score !== undefined && score !== null;
                        const passingLine = selectedModAssignment.Module?.passingLine;
                        const passed =
                          hasValue && passingLine !== undefined ? score >= passingLine : null;
                        return (
                          <tr key={s.id}>
                            <Td className="font-medium text-slate-800">
                              {s.firstName} {s.lastName}
                            </Td>
                            <Td>{hasValue ? score : "-"}</Td>
                            <Td>
                              {hasValue ? (
                                <Badge tone={passed === false ? "fail" : passed === true ? "pass" : "neutral"}>
                                  {passed === null ? "Recorded" : passed ? "Pass" : "Fail"}
                                </Badge>
                              ) : (
                                <Badge tone="warning">Not recorded</Badge>
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <Modal
        open={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        title={viewingStudent ? `${viewingStudent.name} — ${selectedTerm?.name} (${selectedYear?.name})` : ""}
        size="full"
        footer={
          <Button variant="ghost" onClick={() => setViewingStudent(null)}>
            Close
          </Button>
        }
      >
        {studentReportError && (
          <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-6 px-4">
            <AlertTriangle className="text-amber-600" size={20} />
            <p className="text-sm text-slate-500 max-w-sm">{studentReportError}</p>
          </div>
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
              classCategory={studentReport.classCategory ?? classReport?.classCategory}
              termName={selectedTerm?.name}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
