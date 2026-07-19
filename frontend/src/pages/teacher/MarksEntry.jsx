import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Field, Input } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { Pencil, X, Download, Lock, Unlock, Users, BarChart3, Award, FileSpreadsheet, Upload, ChevronDown } from "lucide-react";

// Custom dropdown for the Module/Class picker. A native <select> can't color
// part of an option's text and leave the rest black — the whole <option> is
// one color or none. Since we want the module/class name to always stay
// black and only the "Missing marks / Completed" status to be colored
// (red/green), this renders its own list so each option can mix a black
// segment and a colored segment.
function AssignmentSelect({ assignments, assignmentStatuses, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = assignments.find((a) => String(a.id) === value);
  const currentStatus = current ? assignmentStatuses[current.id] : null;

  function statusLabel(status) {
    if (!status) return null;
    return status.completed
      ? "✓ Marks completed"
      : `⚠ Missing marks (${status.totalStudents - status.recordedCount}/${status.totalStudents})`;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-left outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 flex items-center justify-between gap-2 min-h-[2.75rem]"
      >
        {current ? (
          <span className="flex flex-col min-w-0 flex-1">
            <span className="text-slate-800 truncate min-w-0 block">
              {current.Module?.moduleTitle} — {current.Class?.name}
            </span>
            {currentStatus && (
              <span
                className="text-xs font-medium mt-0.5 truncate block"
                style={{ color: currentStatus.completed ? "#059669" : "#dc2626" }}
              >
                {statusLabel(currentStatus)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">Select assignment</span>
        )}
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {assignments.map((a) => {
            const status = assignmentStatuses[a.id];
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(String(a.id));
                  setOpen(false);
                }}
                className={`w-full flex flex-col text-left px-3.5 py-2 text-sm hover:bg-slate-50 ${
                  String(a.id) === value ? "bg-brand-50" : ""
                }`}
              >
                <span className="text-slate-800 truncate block">
                  {a.Module?.moduleTitle} — {a.Class?.name}
                </span>
                {status && (
                  <span
                    className="text-xs font-medium mt-0.5 truncate block"
                    style={{ color: status.completed ? "#059669" : "#dc2626" }}
                  >
                    {statusLabel(status)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const templateFileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState([]);

  // assignmentId -> { totalStudents, recordedCount, completed } for the
  // currently selected term. Powers the "Missing marks / Completed" status
  // shown next to each module in the Module/Class picker, so a teacher can
  // tell at a glance which modules still need marks without having to open
  // each one first.
  const [assignmentStatuses, setAssignmentStatuses] = useState({});

  // Success messages ("Saved...", "Imported...") are transient confirmations,
  // not something that needs to stay on screen — clear it automatically a
  // couple seconds after it appears.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 2000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    (async () => {
      const [assignmentsRes, yearsRes] = await Promise.all([
        api.get(`/teachers/${user.id}/assignments`),
        api.get("/academic-years"),
      ]);
      setAssignments(assignmentsRes.data.assignments);
      setYears(yearsRes.data.academicYears);
      // Default to the first term of the current academic year so the
      // "missing marks / completed" status on each module can be checked
      // against a real term right away, instead of staying blank until the
      // teacher manually picks one.
      const firstTerm = yearsRes.data.academicYears[0]?.Terms?.[0];
      if (firstTerm) setSelectedTermId(String(firstTerm.id));
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

  // Marks-completion status for every one of this teacher's modules, for
  // whichever term is selected — so the Module/Class picker can show
  // "Missing marks" vs "Completed" next to each option instead of a teacher
  // having to open a module to find out.
  //
  // Extracted into its own function (rather than living only inside the
  // effect below) so it can also be called right after a save/import
  // succeeds — otherwise the status would only ever refresh when the term
  // selection changes, and a teacher who just recorded marks would still
  // see the stale "Missing marks" count until they switched terms or
  // reloaded the page.
  async function refreshAssignmentStatuses(termId, isCancelled = () => false) {
    if (!termId || assignments.length === 0) {
      if (!isCancelled()) setAssignmentStatuses({});
      return;
    }
    try {
      const uniqueClassIds = [...new Set(assignments.map((a) => a.classId))];
      const studentCountEntries = await Promise.all(
        uniqueClassIds.map((classId) =>
          api.get(`/classes/${classId}/students`).then((res) => [classId, res.data.students.length])
        )
      );
      const studentCountByClass = Object.fromEntries(studentCountEntries);

      const statusEntries = await Promise.all(
        assignments.map((a) =>
          api
            .get("/marks", {
              params: { classId: a.classId, moduleId: a.moduleId, termId },
            })
            .then((res) => {
              const totalStudents = studentCountByClass[a.classId] || 0;
              const recordedCount = res.data.marks.length;
              return [
                a.id,
                {
                  totalStudents,
                  recordedCount,
                  completed: totalStudents > 0 && recordedCount >= totalStudents,
                },
              ];
            })
        )
      );
      if (!isCancelled()) setAssignmentStatuses(Object.fromEntries(statusEntries));
    } catch {
      // Non-critical — worst case the status suffix just doesn't show.
      if (!isCancelled()) setAssignmentStatuses({});
    }
  }

  useEffect(() => {
    let cancelled = false;
    refreshAssignmentStatuses(selectedTermId, () => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, selectedTermId]);

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
      // Keep the "Missing marks / Completed" status in the Module/Class
      // picker in sync with what was just saved, instead of leaving it
      // showing the stale pre-save count until the term selection changes.
      refreshAssignmentStatuses(selectedTermId);
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

  // Downloads a spreadsheet pre-filled with the class roster (and any
  // scores already recorded) so a teacher can fill it in offline and bring
  // it back with importTemplateFile below.
  function downloadTemplate() {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({
      classId: currentAssignment.classId,
      moduleId: currentAssignment.moduleId,
      termId: selectedTermId,
    });
    fetch(`${api.defaults.baseURL}/marks/template?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `marks-template-${currentAssignment.Class?.name}-${currentAssignment.Module?.moduleTitle}-${currentTerm?.name}.xlsx`;
        link.click();
      });
  }

  function triggerTemplateUpload() {
    setError("");
    setSuccess("");
    setImportWarnings([]);
    templateFileInputRef.current?.click();
  }

  // Handles the file picked from triggerTemplateUpload: uploads it, then
  // reflects whatever the server actually saved back into the on-screen
  // table exactly as if those scores had been typed in by hand.
  async function importTemplateFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    if (isTermLocked) {
      setError("This term is locked — the school manager has closed it for editing.");
      return;
    }

    const ok = await confirm({
      title: "Import marks from this file?",
      message: `This will save the scores in "${file.name}" for ${currentAssignment.Module?.moduleTitle} — ${currentAssignment.Class?.name}, ${currentTerm?.name}, overwriting any existing marks for the students listed.`,
      confirmText: "Import",
    });
    if (!ok) return;

    setError("");
    setSuccess("");
    setImportWarnings([]);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classId", currentAssignment.classId);
      formData.append("moduleId", currentAssignment.moduleId);
      formData.append("termId", selectedTermId);

      const { data } = await api.post("/marks/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const byStudent = Object.fromEntries(data.marks.map((m) => [m.studentId, String(m.score)]));
      setSavedScores((prev) => ({ ...prev, ...byStudent }));
      setScores((prev) => ({ ...prev, ...byStudent }));
      setEditMode(false);
      setSuccess(`Imported ${data.imported} score(s) from the file.`);
      if (data.warnings?.length) setImportWarnings(data.warnings);
      // Same reason as in handleSubmit: keep the picker's status badge from
      // going stale after marks change.
      refreshAssignmentStatuses(selectedTermId);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Card>
        <div className="flex items-end gap-4 flex-wrap">
          <Field label="Module / Class" className="min-w-[260px] flex-1 sm:min-w-[380px] sm:max-w-[480px]">
            <AssignmentSelect
              assignments={assignments}
              assignmentStatuses={assignmentStatuses}
              value={selectedAssignment}
              onChange={setSelectedAssignment}
            />
            {selectedTermId && (
              <span className="text-xs text-slate-400">
                Status shown is for the selected term below.
              </span>
            )}
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
            <div className="grid grid-cols-2 gap-2 w-full lg:flex lg:w-auto lg:flex-wrap lg:items-center">
              <Button
                size="sm"
                variant="teal"
                onClick={downloadTemplate}
                className="w-full lg:w-auto"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden lg:inline">Download </span>Template
              </Button>
              {!isTermLocked && (
                <>
                  <input
                    ref={templateFileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={importTemplateFile}
                  />
                  {/* Same protection as the marks table itself: once marks are
                      already saved, uploading a template is disabled until
                      the teacher explicitly clicks "Edit Marks" — otherwise a
                      file could silently overwrite recorded scores. */}
                  <Button
                    size="sm"
                    variant="violet"
                    onClick={triggerTemplateUpload}
                    disabled={fieldsDisabled || importing}
                    title={
                      hasSavedMarks && !editMode
                        ? 'Marks are already recorded. Click "Edit Marks" to upload a new file.'
                        : undefined
                    }
                    className="w-full lg:w-auto"
                  >
                    <Upload size={14} />
                    <span className="hidden lg:inline">{importing ? "Importing..." : "Upload Filled Template"}</span>
                    <span className="lg:hidden">{importing ? "Importing..." : "Upload"}</span>
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="teal"
                onClick={downloadEvidencePdf}
                className="w-full lg:w-auto"
              >
                <Download size={14} />
                <span className="hidden lg:inline">Download </span>Evidence PDF
              </Button>
              {!isTermLocked &&
                hasSavedMarks &&
                (editMode ? (
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="w-full lg:w-auto">
                    <X size={14} /> Cancel
                  </Button>
                ) : (
                  <Button size="sm" variant="amber" onClick={startEdit} className="w-full lg:w-auto">
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
          {importWarnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <p className="font-medium mb-1">Some rows in the uploaded file were skipped:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {importWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
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
