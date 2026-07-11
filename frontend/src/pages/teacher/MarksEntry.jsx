import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Field, Select, Input } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { Pencil, X, Download, Lock, Unlock, Users, BarChart3, Award } from "lucide-react";

export default function MarksEntry() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [assignments, setAssignments] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [students, setStudents] = useState([]);

  // `scores` holds what's currently in the input fields (editable draft).
  // `savedScores` holds what's actually persisted on the server for this
  // module/class/term — used to know whether a student already has a mark,
  // and to restore values if editing is cancelled.
  const [scores, setScores] = useState({});
  const [savedScores, setSavedScores] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  // Fields start locked (read-only) the moment marks already exist, so a
  // teacher can't accidentally overwrite recorded marks. "Edit Marks"
  // unlocks them. If nothing has been recorded yet, fields are open for
  // entry immediately — there's nothing to protect yet.
  const [editMode, setEditMode] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState("all"); // "all" | "recorded" | "pending" | "pass" | "fail"
  const tableRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [assignmentsRes, yearsRes] = await Promise.all([
        api.get(`/teachers/${user.id}/assignments`),
        api.get("/academic-years"),
      ]);
      setAssignments(assignmentsRes.data.assignments);
      setYears(yearsRes.data.academicYears);
    })();
  }, [user.id]);

  const currentAssignment = assignments.find((a) => String(a.id) === selectedAssignment);
  const allTerms = years.flatMap((y) => y.Terms || []);
  const currentTerm = allTerms.find((t) => String(t.id) === selectedTermId);
  const isTermLocked = !!currentTerm?.isLocked;
  // moduleWeight and maxScore are always the same value (weight doubles as
  // the ceiling for marks entry) — moduleWeight is the name shown to users.
  const maxScore = currentAssignment?.Module?.moduleWeight ?? currentAssignment?.Module?.maxScore;
  const passingLine = currentAssignment?.Module?.passingLine;
  const hasSavedMarks = Object.keys(savedScores).length > 0;

  // Live summary strip: how many students currently have a value in the
  // form (draft, not just saved) and what the class average/pass rate looks
  // like with those values — updates as the teacher types.
  const enteredScores = students
    .map((s) => scores[s.id])
    .filter((v) => v !== undefined && v !== "")
    .map(Number);
  const recordedCount = enteredScores.length;
  const classAverage =
    recordedCount > 0 ? +(enteredScores.reduce((sum, v) => sum + v, 0) / recordedCount).toFixed(1) : null;
  const passCount =
    passingLine !== undefined ? enteredScores.filter((v) => v >= passingLine).length : null;

  // Same status logic the table uses per row, factored out so the summary
  // cards can filter by it too.
  function statusFor(student) {
    const raw = scores[student.id];
    const hasValue = raw !== undefined && raw !== "";
    if (!hasValue) return "pending";
    const numericValue = Number(raw);
    if (passingLine === undefined) return "recorded";
    return numericValue >= passingLine ? "pass" : "fail";
  }

  const filteredStudents = students.filter((s) => {
    const status = statusFor(s);
    if (studentFilter === "all") return true;
    if (studentFilter === "recorded") return status !== "pending";
    if (studentFilter === "pending") return status === "pending";
    if (studentFilter === "pass") return status === "pass";
    if (studentFilter === "fail") return status === "fail";
    return true;
  });

  function focusStudents(filter) {
    setStudentFilter((current) => (current === filter ? "all" : filter));
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Load this class's students, plus any marks already recorded for the
  // selected module + term, so the teacher sees the live state of what's
  // been entered — not a blank sheet every time.
  useEffect(() => {
    (async () => {
      setError("");
      setSuccess("");
      setFieldErrors({});
      setStudentFilter("all");
      if (!currentAssignment) {
        setStudents([]);
        setScores({});
        setSavedScores({});
        return;
      }
      const { data: studentsData } = await api.get(`/classes/${currentAssignment.classId}/students`);
      setStudents(studentsData.students);

      if (!selectedTermId) {
        setScores({});
        setSavedScores({});
        setEditMode(true);
        return;
      }

      setLoadingMarks(true);
      try {
        const { data } = await api.get("/marks", {
          params: { classId: currentAssignment.classId, moduleId: currentAssignment.moduleId, termId: selectedTermId },
        });
        const byStudent = Object.fromEntries(data.marks.map((m) => [m.studentId, String(m.score)]));
        setSavedScores(byStudent);
        setScores(byStudent);
        // Lock the form if anything's already recorded; otherwise leave it
        // open for first-time entry.
        setEditMode(Object.keys(byStudent).length === 0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingMarks(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignment, selectedTermId]);

  // Live validation: a mark can never go below 0 or above the module's
  // weight (its max score). Values are clamped as the teacher types, and any
  // clamp is surfaced immediately next to the field.
  function updateScore(studentId, rawValue) {
    if (rawValue === "") {
      setScores((s) => ({ ...s, [studentId]: "" }));
      setFieldErrors((e) => ({ ...e, [studentId]: undefined }));
      return;
    }

    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) return; // ignore non-numeric keystrokes entirely

    let clamped = numeric;
    let message;
    if (numeric < 0) {
      clamped = 0;
      message = "Can't be less than 0";
    } else if (maxScore !== undefined && numeric > maxScore) {
      clamped = maxScore;
      message = `Can't exceed ${maxScore}`;
    }

    setScores((s) => ({ ...s, [studentId]: String(clamped) }));
    setFieldErrors((e) => ({ ...e, [studentId]: message }));
  }

  function startEdit() {
    setEditMode(true);
    setSuccess("");
  }

  function cancelEdit() {
    setScores(savedScores);
    setFieldErrors({});
    setEditMode(false);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!currentAssignment || !selectedTermId) {
      setError("Select an assignment and a term first");
      return;
    }
    if (isTermLocked) {
      setError("This term is locked — the school manager has closed it for editing.");
      return;
    }

    const entries = students
      .filter((s) => scores[s.id] !== undefined && scores[s.id] !== "")
      .map((s) => ({ studentId: s.id, score: Number(scores[s.id]) }));

    if (entries.length === 0) {
      setError("Enter at least one score");
      return;
    }

    const ok = await confirm({
      title: "Save these marks?",
      message: `You're about to save ${entries.length} score(s) for ${currentAssignment.Module?.moduleTitle} — ${currentAssignment.Class?.name}, ${currentTerm?.name}. This can still be edited later unless the term is locked.`,
      confirmText: "Save Marks",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.post("/marks", {
        classId: currentAssignment.classId,
        moduleId: currentAssignment.moduleId,
        termId: Number(selectedTermId),
        entries,
      });
      const byStudent = Object.fromEntries(entries.map((e) => [e.studentId, String(e.score)]));
      setSavedScores((prev) => ({ ...prev, ...byStudent }));
      setSuccess(`Saved ${entries.length} score(s) successfully.`);
      setFieldErrors({});
      // Lock the fields again now that these marks are recorded — matches
      // the same protection a fresh page load would give.
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const fieldsDisabled = isTermLocked || !editMode || saving;

  function downloadEvidencePdf() {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({
      classId: currentAssignment.classId,
      moduleId: currentAssignment.moduleId,
      termId: selectedTermId,
    });
    fetch(`${api.defaults.baseURL}/marks/evidence/pdf?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `marks-evidence-${currentAssignment.Class?.name}-${currentAssignment.Module?.moduleTitle}-${currentTerm?.name}.pdf`;
        link.click();
      });
  }

  return (
    <div>
      <Card>
        <div className="flex items-end gap-4 flex-wrap">
          <Field label="Module / Class" className="min-w-[220px]">
            <Select value={selectedAssignment} onChange={(e) => setSelectedAssignment(e.target.value)}>
              <option value="">Select assignment</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.Module?.moduleTitle} — {a.Class?.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={
              <span className="flex items-center gap-1.5">
                Term
                {years[0]?.name && (
                  <span className="font-normal text-slate-400">
                    (current year: <span className="font-medium text-slate-500">{years[0].name}</span>)
                  </span>
                )}
              </span>
            }
            className="min-w-[260px]"
          >
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
        </div>
        {years.length === 0 && (
          <p className="text-xs text-amber-600 mt-3">
            No current academic year has been set by the school manager yet, so no terms are
            available.
          </p>
        )}
      </Card>

      {currentAssignment && selectedTermId && (
        <Card
          title={`Marks — ${currentAssignment.Module?.moduleTitle} (${currentAssignment.Class?.name})`}
          subtitle={`Module weight / max score: ${maxScore}`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={downloadEvidencePdf}>
                <Download size={14} /> Download Evidence PDF
              </Button>
              {!isTermLocked &&
                hasSavedMarks &&
                (editMode ? (
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X size={14} /> Cancel
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={startEdit}>
                    <Pencil size={14} /> Edit Marks
                  </Button>
                ))}
            </div>
          }
        >
          {isTermLocked && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              <Lock size={16} className="text-red-600 shrink-0 mt-0.5" />
              <span>
                This term is locked. You can still see the class list below, but scores can't be
                entered or changed until the school manager reopens it.
              </span>
            </div>
          )}
          {!isTermLocked && hasSavedMarks && !editMode && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 flex items-center justify-between flex-wrap gap-2">
              <span>Marks for this module have already been recorded. Click "Edit Marks" to make changes.</span>
              <Badge tone="neutral">Read-only</Badge>
            </div>
          )}
          {students.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button
                type="button"
                onClick={() => focusStudents("recorded")}
                className={`rounded-lg border bg-white px-4 py-3 flex items-center gap-3 text-left transition hover:border-brand-300 hover:shadow-sm ${
                  studentFilter === "recorded" ? "border-brand-400 ring-1 ring-brand-200" : "border-slate-200"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Recorded</p>
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">
                    {recordedCount} / {students.length}
                  </p>
                </div>
              </button>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <BarChart3 size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Class Average</p>
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">
                    {classAverage !== null ? `${classAverage} / ${maxScore}` : "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => focusStudents("pass")}
                disabled={passingLine === undefined}
                className={`rounded-lg border bg-white px-4 py-3 flex items-center gap-3 text-left transition ${
                  passingLine === undefined
                    ? "border-slate-200 opacity-70 cursor-default"
                    : "hover:border-brand-300 hover:shadow-sm"
                } ${studentFilter === "pass" ? "border-brand-400 ring-1 ring-brand-200" : "border-slate-200"}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <Award size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Passing</p>
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">
                    {passCount !== null && recordedCount > 0 ? `${passCount} / ${recordedCount}` : "—"}
                  </p>
                </div>
              </button>
            </div>
          )}
          {studentFilter !== "all" && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="text-slate-500">
                Showing only:{" "}
                <span className="font-medium text-slate-700">
                  {studentFilter === "recorded" && "students with a mark recorded"}
                  {studentFilter === "pass" && "students currently passing"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStudentFilter("all")}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Clear
              </button>
            </div>
          )}
          <form noValidate onSubmit={handleSubmit}>
            <div className="overflow-x-auto" ref={tableRef}>
              <Table>
                <Thead>
                  <tr>
                    <Th>Student</Th>
                    <Th className="w-40">Score (0-{maxScore})</Th>
                    <Th className="w-28">Status</Th>
                  </tr>
                </Thead>
                <tbody>
                  {loadingMarks && <EmptyRow colSpan={3}>Loading recorded marks…</EmptyRow>}
                  {!loadingMarks && students.length === 0 && (
                    <EmptyRow colSpan={3}>No students in this class yet.</EmptyRow>
                  )}
                  {!loadingMarks && students.length > 0 && filteredStudents.length === 0 && (
                    <EmptyRow colSpan={3}>No students match this filter.</EmptyRow>
                  )}
                  {!loadingMarks &&
                    filteredStudents.map((s) => {
                      const raw = scores[s.id];
                      const hasValue = raw !== undefined && raw !== "";
                      const numericValue = hasValue ? Number(raw) : null;
                      const passed =
                        hasValue && passingLine !== undefined ? numericValue >= passingLine : null;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80">
                          <Td className="font-medium text-slate-800">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                                {s.firstName?.[0]?.toUpperCase()}
                                {s.lastName?.[0]?.toUpperCase()}
                              </div>
                              {s.firstName} {s.lastName}
                            </div>
                          </Td>
                          <Td>
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                min="0"
                                max={maxScore}
                                value={scores[s.id] ?? ""}
                                onChange={(e) => updateScore(s.id, e.target.value)}
                                disabled={fieldsDisabled}
                                className="w-24"
                              />
                              {fieldErrors[s.id] && (
                                <span className="text-xs text-red-600">{fieldErrors[s.id]}</span>
                              )}
                            </div>
                          </Td>
                          <Td>
                            {hasValue ? (
                              <Badge tone={passed === false ? "fail" : passed === true ? "pass" : "neutral"}>
                                {passed === null ? "Recorded" : passed ? "Pass" : "Fail"}
                              </Badge>
                            ) : (
                              <Badge tone="warning">Pending</Badge>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                </tbody>
              </Table>
            </div>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Button type="submit" disabled={students.length === 0 || fieldsDisabled}>
                {saving ? "Saving..." : "Save Marks"}
              </Button>
              <ErrorText>{error}</ErrorText>
              <SuccessText>{success}</SuccessText>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
