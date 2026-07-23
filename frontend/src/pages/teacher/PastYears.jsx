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
import { CalendarClock, Lock, Eye, AlertTriangle, GraduationCap } from "lucide-react";

// Read-only history for a class teacher: pick an old academic year, see the
// class you were class teacher of that year, and view its report cards —
// on screen only, the same report card layout the "Reports" page uses.
// Nothing on this page ever writes anything — the backend already refuses
// any write against a non-current year, so this page simply never shows a
// way to try. It's the teacher-side counterpart to the manager's year
// switcher (YearContext/YearSwitcher), scoped down to "my own old class,
// view only" instead of "browse everything".
export default function PastYears() {
  const { user } = useAuth();

  const [years, setYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [selectedYearId, setSelectedYearId] = useState("");

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
  // year to year, so this is re-fetched every time the year changes.
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
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, [selectedYearId, user.id]);

  const selectedYear = years.find((y) => String(y.id) === selectedYearId);
  const terms = selectedYear?.Terms || [];
  const selectedTerm = terms.find((t) => String(t.id) === selectedTermId);

  useEffect(() => {
    setError("");
    setClassReport(null);
    if (!selectedClassId || !selectedTermId) return;
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
  }, [selectedClassId, selectedTermId]);

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

            <Field label="Class" className="min-w-[180px] flex-1 sm:flex-none">
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={loadingClasses || classes.length === 0}
              >
                {classes.length === 0 && <option value="">No class of yours that year</option>}
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
                      className={`inline-flex items-center rounded-lg border-2 px-3 py-2 text-sm transition ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            {selectedYear && (
              <Badge tone="warning">
                <CalendarClock size={12} /> Viewing (archived): {selectedYear.name}
              </Badge>
            )}
          </div>
        )}

        {!loadingClasses && years.length > 0 && classes.length === 0 && (
          <p className="text-xs text-slate-400 mt-3">
            You weren't the class teacher of any class in {selectedYear?.name || "this year"}.
          </p>
        )}
      </Card>

      {error && (
        <Card>
          <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-8 px-6">
            <AlertTriangle className="text-amber-600" size={22} />
            <p className="text-sm text-slate-500 max-w-sm">{error}</p>
          </div>
        </Card>
      )}

      {loadingReport && (
        <Card>
          <p className="text-sm text-slate-400 py-4 text-center">Loading report…</p>
        </Card>
      )}

      {classReport && !loadingReport && (
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
