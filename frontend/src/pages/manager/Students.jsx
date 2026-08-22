import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import ArchivedYearBanner from "../../components/ArchivedYearBanner";
import PortalCredentialsModal from "../../components/PortalCredentialsModal";
import { openCredentialsPrintWindow } from "../../utils/printCredentials";
import { useYear } from "../../context/YearContext";
import { usePagination } from "../../hooks/usePagination";
import { useSort } from "../../hooks/useSort";
import { Field, Input, Select, IconInput, IconSelect } from "../../components/ui/FormField";
import ClassDropdown from "../../components/ui/ClassDropdown";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, SortableTh, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import Badge from "../../components/ui/Badge";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import {
  Plus,
  GraduationCap,
  Pencil,
  Trash2,
  FileDown,
  User,
  UserCircle2,
  Phone,
  Cake,
  CopyPlus,
  CalendarDays,
  Users,
  Info,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  KeyRound,
} from "lucide-react";

const emptyForm = { firstName: "", lastName: "", dob: "", sex: "", guardianName: "", guardianPhone: "" };

// Shown in place of DOB/guardian/etc. when the field is empty in the
// database (null or ""), so a missing value reads as clearly missing
// rather than blending in with real data.
function NA() {
  return <span className="italic text-amber-500">N/A</span>;
}

function formatDob(dob) {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sexLabel(sex) {
  if (sex === "M") return "Male";
  if (sex === "F") return "Female";
  return "-";
}

export default function Students() {
  const confirm = useConfirm();
  const notify = useNotify();
  const { viewingYearId, viewingYear, isCurrentView } = useYear();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null); // student object being edited, or null
  const [form, setForm] = useState(emptyForm);
  const [formClassId, setFormClassId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newAccountCredential, setNewAccountCredential] = useState(null); // portal credential just auto-issued for a newly created student
  const [query, setQuery] = useState("");
  const [sexFilter, setSexFilter] = useState(""); // "" = all, "M" = boys, "F" = girls
  const [statusFilter, setStatusFilter] = useState("active"); // "" = all, "active", "inactive"

  // Arriving from the header search (?classId=&highlight=): preselect the
  // class once classes have loaded, then glow + scroll to the row once
  // students have loaded. Each param is cleared from the URL immediately
  // after being read into state — the effects below key off the *param*
  // changing, so if we left it sitting in the URL, clicking the same class
  // or student again from the header search (a no-op change to the URL)
  // wouldn't re-trigger anything. Clearing it means the next click, even to
  // an identical target, is always seen as a fresh value.
  const [searchParams, setSearchParams] = useSearchParams();
  const classIdParam = searchParams.get("classId");
  const highlightParam = searchParams.get("highlight");
  const highlightRowRef = useRef(null);
  const [highlightId, setHighlightId] = useState(null);

  // --- Registration entry point: manager first chooses whether this is a
  // brand-new student (never in the school before) or a student who's
  // already in the school system (being pulled into this class from
  // another year/class). This choice determines which flow opens next —
  // Enroll Student has no path to "Pull", and Pull Students never shows
  // the new-registration form — so a manager can't accidentally create a
  // duplicate record for someone who already exists.
  const [choosingEntryType, setChoosingEntryType] = useState(false);
  const [showPortalCredentials, setShowPortalCredentials] = useState(false);

  function openEntryChoice() {
    if (!selectedClassId) return;
    setChoosingEntryType(true);
  }

  function chooseNewStudent() {
    setChoosingEntryType(false);
    openCreate();
  }

  function chooseExistingStudent() {
    setChoosingEntryType(false);
    openPull();
  }

  // --- Pull Students (copy from another class/year into the class
  // currently being viewed) ---
  const [pulling, setPulling] = useState(false);
  const [allYears, setAllYears] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [pullSourceYearId, setPullSourceYearId] = useState("");
  const [pullSourceClassId, setPullSourceClassId] = useState("");
  const [pullRoster, setPullRoster] = useState([]);
  const [pullSelectedIds, setPullSelectedIds] = useState([]);
  const [pullRosterLoading, setPullRosterLoading] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullError, setPullError] = useState("");
  const [pullResults, setPullResults] = useState(null);

  async function loadClasses() {
    if (!viewingYearId) return;
    const { data } = await api.get("/classes", { params: { academicYearId: viewingYearId } });
    setClasses(data.classes);
    // The previously-selected class may not exist in the newly-viewed year.
    setSelectedClassId((prev) =>
      data.classes.some((c) => String(c.id) === prev) ? prev : ""
    );
  }

  async function loadStudents(classId) {
    if (!classId) return setStudents([]);
    const { data } = await api.get(`/classes/${classId}/students`);
    setStudents(data.students);
  }

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingYearId]);

  useEffect(() => {
    loadStudents(selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    if (!classIdParam || classes.length === 0) return;
    if (classes.some((c) => String(c.id) === classIdParam)) {
      setSelectedClassId(classIdParam);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("classId");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, classIdParam]);

  useEffect(() => {
    if (!highlightParam) return;
    setHighlightId(Number(highlightParam));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("highlight");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightParam]);

  // Arriving from search at an inactive student: the default "Active"
  // filter would otherwise hide them from the list entirely, so the glow
  // scroll-to above would never find a row to land on. Switch to "All" so
  // whoever they searched for actually shows up.
  useEffect(() => {
    if (!highlightId || students.length === 0) return;
    const target = students.find((s) => s.id === highlightId);
    if (target && target.status === "inactive" && statusFilter === "active") {
      setStatusFilter("");
    }
    // Deliberately NOT depending on statusFilter: this should only fire once,
    // right when we land from a search hit. If it re-ran every time
    // statusFilter changes, it would fight the manager's own clicks — e.g.
    // clicking "Active" right after landing on an inactive student would get
    // immediately flipped back to "All", making the Active tab look broken
    // until a full page refresh cleared highlightId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, students]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setForm(emptyForm);
    setFormClassId(selectedClassId);
    setEditingStudent(null);
    setError("");
    setCreating(true);
  }

  function openEdit(student) {
    setForm({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      dob: student.dob || "",
      sex: student.sex || "",
      guardianName: student.guardianName || "",
      guardianPhone: student.guardianPhone || "",
    });
    setFormClassId(String(student.classId));
    setEditingStudent(student);
    setError("");
    setCreating(true);
  }

  function closeModal() {
    setCreating(false);
    setEditingStudent(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!formClassId) {
      setError("Select a class first");
      return;
    }
    setSaving(true);
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, { classId: Number(formClassId), ...form });
      } else {
        const { data } = await api.post("/students", { classId: Number(formClassId), ...form });
        if (data.portalCredential) setNewAccountCredential(data.portalCredential);
      }
      closeModal();
      await loadStudents(selectedClassId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedClass = classes.find((c) => String(c.id) === selectedClassId);

  // Source-class options for pulling: any class NOT in the year currently
  // being viewed (pulling is for bringing students in from another year —
  // a same-year move is just editing the student's class directly).
  const pullSourceClasses = allClasses.filter(
    (c) =>
      String(c.academicYearId ?? c.AcademicYear?.id) === pullSourceYearId &&
      String(c.academicYearId ?? c.AcademicYear?.id) !== String(selectedClass?.academicYearId)
  );

  async function openPull() {
    if (!selectedClassId) return;
    setPullError("");
    setPullResults(null);
    setPullSourceYearId("");
    setPullSourceClassId("");
    setPullRoster([]);
    setPullSelectedIds([]);
    setPulling(true);
    try {
      const [yearsRes, classesRes] = await Promise.all([
        api.get("/academic-years", { params: { all: true } }),
        api.get("/classes", { params: { all: true } }),
      ]);
      setAllYears(yearsRes.data.academicYears);
      setAllClasses(classesRes.data.classes);
    } catch (err) {
      setPullError(err.message);
    }
  }

  function closePull() {
    setPulling(false);
  }

  async function loadPullRoster(classId, { resetResults = true } = {}) {
    if (!classId || !selectedClass) return setPullRoster([]);
    setPullRosterLoading(true);
    setPullError("");
    if (resetResults) setPullResults(null);
    try {
      const { data } = await api.get("/promotions/roster", {
        params: { classId, destAcademicYearId: selectedClass.academicYearId },
      });
      setPullRoster(data.students);
      // Pre-select everyone not already pulled in, so pulling the whole
      // class across is a single click.
      setPullSelectedIds(
        data.students.filter((s) => !s.alreadyProcessedForDestYear).map((s) => s.id)
      );
    } catch (err) {
      setPullError(err.message);
    } finally {
      setPullRosterLoading(false);
    }
  }

  useEffect(() => {
    loadPullRoster(pullSourceClassId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullSourceClassId]);

  function togglePullStudent(id) {
    setPullSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function togglePullAll() {
    const selectable = pullRoster.filter((s) => !s.alreadyProcessedForDestYear).map((s) => s.id);
    setPullSelectedIds((ids) => (ids.length === selectable.length ? [] : selectable));
  }

  async function handlePullSubmit() {
    setPullError("");
    setPullResults(null);
    if (!pullSourceClassId) return setPullError("Choose a class to pull from first.");
    if (pullSelectedIds.length === 0) return setPullError("Select at least one student.");

    const sourceClassName = allClasses.find((c) => String(c.id) === pullSourceClassId)?.name;
    const ok = await confirm({
      title: "Pull these students?",
      message: `${pullSelectedIds.length} student(s) will be copied from ${sourceClassName} into ${selectedClass.name}. Their record in ${sourceClassName} is not changed or removed — this only adds a new one.`,
      confirmText: "Yes, pull them",
      tone: "primary",
    });
    if (!ok) return;

    setPullSubmitting(true);
    try {
      const { data } = await api.post("/promotions", {
        sourceClassId: Number(pullSourceClassId),
        destClassId: Number(selectedClassId),
        status: "promoted",
        studentIds: pullSelectedIds,
      });
      setPullResults(data.results);
      const succeeded = data.results.filter((r) => r.success).length;
      notify({
        title: succeeded > 0 ? "Students pulled" : "Nothing pulled",
        message: data.summary,
        tone: succeeded > 0 ? "info" : "warning",
      });
      await loadPullRoster(pullSourceClassId, { resetResults: false });
      await loadStudents(selectedClassId);
    } catch (err) {
      setPullError(err.message);
    } finally {
      setPullSubmitting(false);
    }
  }

  const filteredStudents = students.filter((s) => {
    if (sexFilter && s.sex !== sexFilter) return false;
    if (statusFilter && (s.status || "active") !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.admissionNumber, s.firstName, s.lastName, s.guardianName, s.guardianPhone]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });

  // Boys/girls/total counts reflect whatever is currently filtered
  // (status, sex, search) so the summary bar always matches what's
  // actually visible in the table below, not the full class roster.
  const boysCount = filteredStudents.filter((s) => s.sex === "M").length;
  const girlsCount = filteredStudents.filter((s) => s.sex === "F").length;

  const { sorted: sortedStudents, sort, toggleSort } = useSort(filteredStudents, {
    admissionNumber: (s) => s.admissionNumber,
    name: (s) => `${s.firstName} ${s.lastName}`.toLowerCase(),
    status: (s) => (s.dismissedPermanently ? 2 : s.status === "inactive" ? 1 : 0),
    sex: (s) => s.sex,
    guardian: (s) => s.guardianName?.toLowerCase(),
  });

  const { pageItems: pagedStudents, page, setPage, totalPages, total, pageSize, setPageSize } =
    usePagination(sortedStudents, 10);

  useEffect(() => {
    if (!highlightId || sortedStudents.length === 0) return;
    const idx = sortedStudents.findIndex((s) => s.id === highlightId);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) setPage(targetPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, sortedStudents, pageSize]);

  useEffect(() => {
    if (highlightId && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Fade the glow after a few seconds so it doesn't linger once the
      // manager has clearly landed on the right row.
      const t = setTimeout(() => setHighlightId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [highlightId, page]);

  function downloadStudentListExcel() {
    if (!selectedClassId) return;
    const token = localStorage.getItem("token");
    fetch(`${api.defaults.baseURL}/classes/${selectedClassId}/students/excel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `students-${selectedClass?.name || "class"}.xlsx`;
        link.click();
      });
  }

  async function handleDelete(student) {
    const ok = await confirm({
      title: `Delete ${student.firstName} ${student.lastName}?`,
      message:
        "This can't be undone. If marks or Behavior/SBMS misconduct records have already been recorded for this student, deletion will be blocked to protect that data.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/students/${student.id}`);
      await loadStudents(selectedClassId);
    } catch (err) {
      const blocked = ["STUDENT_HAS_MARKS", "STUDENT_HAS_MISCONDUCT_RECORDS"].includes(err.code);
      notify({
        title: blocked ? "Can't delete this student" : "Delete failed",
        message: err.message,
        tone: blocked ? "warning" : "error",
      });
    }
  }

  async function handleToggleStatus(student) {
    const nextStatus = student.status === "inactive" ? "active" : "inactive";
    const ok = await confirm({
      title: nextStatus === "inactive" ? `Mark ${student.firstName} ${student.lastName} inactive?` : `Reactivate ${student.firstName} ${student.lastName}?`,
      message:
        nextStatus === "inactive"
          ? "They'll drop off active rosters and student lists, but their record, marks, and Behavior/SBMS history stay intact. You can reactivate them anytime."
          : "They'll show up on active rosters and student lists again.",
      confirmText: nextStatus === "inactive" ? "Mark inactive" : "Reactivate",
      tone: nextStatus === "inactive" ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      await api.patch(`/students/${student.id}/status`, { status: nextStatus });
      await loadStudents(selectedClassId);
    } catch (err) {
      notify({ title: "Couldn't update status", message: err.message, tone: "error" });
    }
  }

  return (
    <div>
      <ArchivedYearBanner />

      {/* Class picker + primary actions, grouped together on a navy card so
          the "which class" decision and what you can do with it read as one
          unit instead of two disconnected controls. */}
      <div className="relative rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-600 p-5 sm:p-6 mb-6 shadow-lg shadow-brand-500/10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-white/5" />
        </div>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 max-w-xs">
            <ClassDropdown
              classes={classes}
              value={selectedClassId}
              onChange={setSelectedClassId}
              includeAll={false}
              placeholder="Select a class"
              label="Class"
              variant="light"
              fullWidth
            />
          </div>

          {isCurrentView && (
            <div className="flex flex-wrap gap-2">
              <Button variant="light" onClick={openEntryChoice} disabled={!selectedClassId}>
                <Plus size={16} /> Enroll Student
              </Button>
              <Button
                variant="dark"
                onClick={() => setShowPortalCredentials(true)}
                disabled={!selectedClassId}
              >
                <KeyRound size={16} /> Portal Credentials
              </Button>
            </div>
          )}
        </div>
      </div>

      {selectedClassId && (
        <Card
          title={`Students in ${selectedClass?.name || ""}`}
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "", label: "All" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusFilter(opt.value)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition ${
                      opt.value === "inactive" ? "text-sm" : "text-xs"
                    } ${
                      statusFilter === opt.value
                        ? opt.value === "inactive"
                          ? "bg-white text-amber-600 shadow-sm"
                          : "bg-white text-brand-600 shadow-sm"
                        : opt.value === "inactive"
                        ? "text-amber-600 hover:text-amber-700"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {statusFilter === opt.value && opt.value !== "inactive" && (
                      <Check size={12} strokeWidth={3} className="shrink-0 text-brand-500" />
                    )}
                    {opt.value === "inactive" && <Ban size={16} strokeWidth={2.5} className="shrink-0 text-amber-500" />}
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[
                  { value: "", label: "All" },
                  { value: "M", label: "Boys" },
                  { value: "F", label: "Girls" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSexFilter(opt.value)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      sexFilter === opt.value
                        ? "bg-white text-brand-600 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {sexFilter === opt.value && (
                      <Check size={12} strokeWidth={3} className="shrink-0 text-brand-500" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by name, ID, or guardian..."
                className="w-full sm:w-64"
              />
              <Button size="sm" variant="teal" onClick={downloadStudentListExcel} disabled={students.length === 0}>
                <FileDown size={14} /> Get List
              </Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 mb-4 text-sm">
            <span className="font-semibold text-slate-700">
              {filteredStudents.length} Total Student{filteredStudents.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {boysCount} Boys
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              {girlsCount} Girls
            </span>
          </div>
          <Table>
            <Thead>
              <tr>
                <SortableTh sortKey="admissionNumber" sort={sort} onSort={toggleSort}>Student ID</SortableTh>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>Name</SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
                <SortableTh sortKey="sex" sort={sort} onSort={toggleSort}>Sex</SortableTh>
                <SortableTh sortKey="guardian" sort={sort} onSort={toggleSort}>Guardian</SortableTh>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <tbody>
              {students.length === 0 && (
                <EmptyRow colSpan={6}>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <GraduationCap size={22} className="text-slate-300" />
                    No students enrolled yet. Click "Enroll Student" to add one.
                  </div>
                </EmptyRow>
              )}
              {students.length > 0 && filteredStudents.length === 0 && (
                <EmptyRow colSpan={6}>
                  {query
                    ? `No students match "${query}".`
                    : "No students match the selected filter."}
                </EmptyRow>
              )}
              {pagedStudents.map((s) => (
                <tr
                  key={s.id}
                  ref={s.id === highlightId ? highlightRowRef : undefined}
                  className={
                    s.id === highlightId
                      ? "bg-amber-50 ring-1 ring-inset ring-amber-300 transition-colors duration-1000"
                      : s.dismissedPermanently || s.status === "inactive"
                      ? "bg-red-50/60"
                      : undefined
                  }
                >
                  <Td className="font-mono text-slate-500">{s.admissionNumber || "-"}</Td>
                  <Td className="font-medium text-slate-800">
                    {s.firstName} {s.lastName}
                    {s.dob ? (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-slate-400">
                        <Cake size={12} className="text-slate-400 shrink-0" />
                        {formatDob(s.dob)}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {s.dismissedPermanently ? (
                      // Deliberation outcome always wins over the plain
                      // active/inactive status — it's the more specific and
                      // more important thing for a manager to see at a
                      // glance, so we don't show both at once.
                      <span title="Dismissed permanently (deliberation outcome)" className="shrink-0">
                        <Badge tone="fail">
                          <Ban size={11} /> Dismissed
                        </Badge>
                      </span>
                    ) : s.status === "inactive" ? (
                      <span title="Inactive" className="shrink-0">
                        <Badge tone="warning">
                          <Ban size={11} /> Inactive
                        </Badge>
                      </span>
                    ) : (
                      <span title="Active" className="shrink-0">
                        <Badge tone="pass">
                          <CheckCircle2 size={11} /> Active
                        </Badge>
                      </span>
                    )}
                  </Td>
                  <Td>{sexLabel(s.sex)}</Td>
                  <Td>
                    {s.guardianName ? (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <UserCircle2 size={13} className="text-slate-400 shrink-0" />
                          {s.guardianName}
                        </div>
                        {s.guardianPhone ? (
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                            <Phone size={12} className="text-emerald-500 shrink-0" />
                            {s.guardianPhone}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-xs">
                            <NA />
                          </div>
                        )}
                      </div>
                    ) : (
                      <NA />
                    )}
                  </Td>
                  <Td>
                    {isCurrentView ? (
                      <div className="flex items-center gap-2">
                        {s.status !== "inactive" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            title={s.dismissedPermanently ? "Can't edit a dismissed student" : "Edit"}
                            aria-label="Edit"
                            onClick={() => openEdit(s)}
                            disabled={s.dismissedPermanently}
                          >
                            <Pencil size={14} />
                          </Button>
                        )}
                        {s.status === "inactive" && s.dismissedPermanently ? (
                          <span className="text-xs italic text-slate-400 self-center">
                            Dismissed, can't reactivate
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant={s.status === "inactive" ? "success" : "amber"}
                            title={s.status === "inactive" ? "Reactivate" : "Mark inactive"}
                            aria-label={s.status === "inactive" ? "Reactivate" : "Mark inactive"}
                            onClick={() => handleToggleStatus(s)}
                          >
                            {s.status === "inactive" ? <Check size={14} /> : <Ban size={14} />}
                          </Button>
                        )}
                        {s.status !== "inactive" && (
                          <Button
                            size="sm"
                            variant="danger"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => handleDelete(s)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Read-only</div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {!selectedClassId && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-400">
              <GraduationCap size={24} />
            </div>
            <p className="text-sm text-slate-500 max-w-sm">
              Students of the selected class will be displayed here. Select a class above to see its students.
            </p>
          </div>
        </Card>
      )}

      <Modal
        open={choosingEntryType}
        onClose={() => setChoosingEntryType(false)}
        title="Enroll a Student"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3">
            <CalendarDays size={16} className="shrink-0 text-brand-500" />
            <p className="text-xs leading-relaxed text-slate-600">
              Registering into <span className="font-semibold text-slate-800">{selectedClass?.name}</span>
              {" · "}
              <span className="font-semibold text-slate-800">{viewingYear?.name || "current year"}</span>
            </p>
          </div>

          <p className="text-sm text-slate-500">Is this student new to the school, or already enrolled somewhere in the system?</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseExistingStudent}
              className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 p-4 text-left transition hover:border-teal-400 hover:bg-teal-50/50 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 transition group-hover:bg-teal-500 group-hover:text-white">
                <CopyPlus size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Already in the School</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Already has a record in another class or academic year. Pull it in — no new registration needed.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-teal-600 group-hover:gap-1.5 transition-all">
                Pull existing <ArrowRight size={13} />
              </span>
            </button>

            <button
              type="button"
              onClick={chooseNewStudent}
              className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white">
                <Plus size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">New Student</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  First time in the school. Opens a blank form to create their record from scratch.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5 transition-all">
                Enroll new <ArrowRight size={13} />
              </span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={creating}
        onClose={closeModal}
        title={
          editingStudent
            ? `Edit ${editingStudent.firstName} ${editingStudent.lastName}`
            : `Enroll a Student${selectedClass ? ` — ${selectedClass.name}` : ""}`
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingStudent ? "Save Changes" : "Enroll"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {!editingStudent && (
            <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-brand-500 flex items-center justify-center">
                <GraduationCap size={16} className="text-white" />
              </div>
              <p className="text-xs text-brand-700 leading-snug">
                A Student ID is generated automatically from the school, class, and enrollment year once you
                enroll this student.
              </p>
            </div>
          )}

          <Field label="Class" className="max-w-xs">
            <ClassDropdown
              classes={classes}
              value={formClassId}
              onChange={setFormClassId}
              includeAll={false}
              placeholder="Select a class"
              fullWidth
            />
          </Field>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Student Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name">
                <IconInput
                  icon={User}
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  placeholder="e.g. Aline"
                  required
                  autoFocus
                />
              </Field>
              <Field label="Last Name">
                <IconInput
                  icon={User}
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  placeholder="e.g. Uwase"
                  required
                />
              </Field>
              <Field label="Date of Birth">
                <IconInput
                  icon={Cake}
                  type="date"
                  value={form.dob}
                  onChange={(e) => updateField("dob", e.target.value)}
                />
              </Field>
              <Field label="Sex">
                <Select value={form.sex} onChange={(e) => updateField("sex", e.target.value)}>
                  <option value="">Select...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Guardian Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Guardian Name">
                <IconInput
                  icon={UserCircle2}
                  value={form.guardianName}
                  onChange={(e) => updateField("guardianName", e.target.value)}
                  placeholder="e.g. Jean Baptiste (optional)"
                />
              </Field>
              <Field label="Guardian Phone">
                <IconInput
                  icon={Phone}
                  value={form.guardianPhone}
                  onChange={(e) => updateField("guardianPhone", e.target.value)}
                  placeholder="e.g. 0788123456"
                />
              </Field>
            </div>
          </div>

          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={pulling}
        onClose={closePull}
        size="xl"
        title={`Pull Students into ${selectedClass?.name || ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={closePull}>
              Close
            </Button>
            <Button onClick={handlePullSubmit} disabled={pullSubmitting || pullSelectedIds.length === 0}>
              {pullSubmitting
                ? "Pulling..."
                : `Pull ${pullSelectedIds.length || ""} Student${pullSelectedIds.length === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Explainer banner */}
          <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3">
            <Info size={18} className="mt-0.5 shrink-0 text-brand-500" />
            <p className="text-xs leading-relaxed text-slate-600">
              Pull in students from{" "}
              <span className="font-semibold text-slate-800">any academic year — past or present</span>{" "}
              and any class within it. This <span className="font-medium text-slate-700">copies</span> them into{" "}
              <span className="font-semibold text-slate-800">{selectedClass?.name}</span> — their record in the
              original class is never changed or removed.
            </p>
          </div>

          {/* Step 1 — pick source year + class */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                1
              </span>
              <h3 className="text-sm font-semibold text-slate-700">Choose where to pull from</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic year">
                <IconSelect
                  icon={CalendarDays}
                  value={pullSourceYearId}
                  onChange={(e) => {
                    setPullSourceYearId(e.target.value);
                    setPullSourceClassId("");
                  }}
                >
                  <option value="">Select year</option>
                  {allYears
                    .filter((y) => String(y.id) !== String(selectedClass?.academicYearId))
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? "(current)" : ""}
                      </option>
                    ))}
                </IconSelect>
                {allYears.filter((y) => String(y.id) !== String(selectedClass?.academicYearId)).length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No other academic years exist yet — create one under Academic Years to pull students across
                    years.
                  </p>
                )}
              </Field>
              <Field label="Class">
                <ClassDropdown
                  classes={pullSourceClasses}
                  value={pullSourceClassId}
                  onChange={setPullSourceClassId}
                  includeAll={false}
                  placeholder="Select class"
                  disabled={!pullSourceYearId}
                  fullWidth
                />
              </Field>
            </div>

            {pullSourceClassId && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                <Badge tone="teal">
                  {pullSourceClasses.find((c) => String(c.id) === pullSourceClassId)?.name}
                  {" · "}
                  {allYears.find((y) => String(y.id) === pullSourceYearId)?.name}
                </Badge>
                <ArrowRight size={14} className="text-slate-400" />
                <Badge tone="manager">
                  {selectedClass?.name}
                  {" · "}
                  {allYears.find((y) => String(y.id) === String(selectedClass?.academicYearId))?.name ||
                    "Current year"}
                </Badge>
              </div>
            )}
          </div>

          {/* Step 2 — pick students */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                  2
                </span>
                <h3 className="text-sm font-semibold text-slate-700">Pick students to pull</h3>
              </div>
              {pullSourceClassId && pullRoster.length > 0 && (
                <Button size="sm" variant="secondary" onClick={togglePullAll}>
                  <Users size={14} /> Select / deselect all
                </Button>
              )}
            </div>

            {pullSourceClassId && (
              <p className="mb-3 text-xs text-slate-500">
                {pullRoster.length} student{pullRoster.length === 1 ? "" : "s"} in this class. Pulling copies them
                in — it never changes or removes their record in the source class.
              </p>
            )}

            <Table>
              <Thead>
                <tr>
                  <Th className="w-10"></Th>
                  <Th>Student</Th>
                  <Th>Student ID</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </Thead>
              <tbody>
                {pullRosterLoading && <EmptyRow colSpan={4}>Loading roster...</EmptyRow>}
                {!pullRosterLoading && !pullSourceClassId && (
                  <EmptyRow colSpan={4}>Choose a year and class above to see its students.</EmptyRow>
                )}
                {!pullRosterLoading && pullSourceClassId && pullRoster.length === 0 && (
                  <EmptyRow colSpan={4}>No active students in this class.</EmptyRow>
                )}
                {!pullRosterLoading &&
                  pullRoster.map((s) => {
                    const result = pullResults?.find((r) => r.studentId === s.id);
                    return (
                      <tr key={s.id} className="transition hover:bg-slate-50/80">
                        <Td>
                          <input
                            type="checkbox"
                            checked={pullSelectedIds.includes(s.id)}
                            disabled={s.alreadyProcessedForDestYear}
                            onChange={() => togglePullStudent(s.id)}
                            className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                          />
                        </Td>
                        <Td className="font-medium text-slate-800">
                          {s.firstName} {s.lastName}
                        </Td>
                        <Td className="text-slate-500">{s.admissionNumber || "-"}</Td>
                        <Td className="text-right">
                          {result ? (
                            <Badge tone={result.success ? "pass" : "fail"}>
                              {result.success ? "Pulled" : result.message}
                            </Badge>
                          ) : s.alreadyProcessedForDestYear ? (
                            <Badge tone="neutral">Already pulled</Badge>
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

          <ErrorText>{pullError}</ErrorText>
        </div>
      </Modal>

      <PortalCredentialsModal
        open={showPortalCredentials}
        onClose={() => setShowPortalCredentials(false)}
        classId={selectedClassId}
        className={selectedClass?.name}
      />

      <Modal
        open={!!newAccountCredential}
        onClose={() => setNewAccountCredential(null)}
        title="Portal account created — write this down now"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                openCredentialsPrintWindow("New Portal Credential", [newAccountCredential])
              }
            >
              Print
            </Button>
            <Button onClick={() => setNewAccountCredential(null)}>Done</Button>
          </>
        }
      >
        {newAccountCredential && (
          <>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              This temporary password can only be viewed again until the student changes it — from the class's
              Portal Credentials panel — so print or share it now.
            </p>
            <div className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800 text-sm">{newAccountCredential.studentName}</div>
                <div className="text-xs text-slate-400">
                  Adm. {newAccountCredential.admissionNumber || "—"} · Portal ID: {newAccountCredential.portalUsername}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Temp password</div>
                <div className="font-mono font-semibold text-slate-800">{newAccountCredential.tempPassword}</div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
