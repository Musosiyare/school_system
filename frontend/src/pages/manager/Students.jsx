import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import ArchivedYearBanner from "../../components/ArchivedYearBanner";
import { useYear } from "../../context/YearContext";
import { usePagination } from "../../hooks/usePagination";
import { useSort } from "../../hooks/useSort";
import { Field, Input, Select, IconInput, IconSelect } from "../../components/ui/FormField";
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
  Layers,
  CopyPlus,
  CalendarDays,
  Users,
  Info,
  ArrowRight,
} from "lucide-react";

const emptyForm = { firstName: "", lastName: "", dob: "", sex: "", guardianName: "", guardianPhone: "" };

function formatDob(dob) {
  if (!dob) return "-";
  return new Date(dob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function sexLabel(sex) {
  if (sex === "M") return "Male";
  if (sex === "F") return "Female";
  return "-";
}

export default function Students() {
  const confirm = useConfirm();
  const notify = useNotify();
  const { viewingYearId, isCurrentView } = useYear();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null); // student object being edited, or null
  const [form, setForm] = useState(emptyForm);
  const [formClassId, setFormClassId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

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
        await api.post("/students", { classId: Number(formClassId), ...form });
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
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.admissionNumber, s.firstName, s.lastName, s.guardianName, s.guardianPhone]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });

  const { sorted: sortedStudents, sort, toggleSort } = useSort(filteredStudents, {
    admissionNumber: (s) => s.admissionNumber,
    name: (s) => `${s.firstName} ${s.lastName}`.toLowerCase(),
    dob: (s) => (s.dob ? new Date(s.dob).getTime() : null),
    sex: (s) => s.sex,
    guardian: (s) => s.guardianName?.toLowerCase(),
  });

  const { pageItems: pagedStudents, page, setPage, totalPages, total, pageSize } =
    usePagination(sortedStudents, 8);

  function downloadStudentListPdf() {
    if (!selectedClassId) return;
    const token = localStorage.getItem("token");
    fetch(`${api.defaults.baseURL}/classes/${selectedClassId}/students/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `students-${selectedClass?.name || "class"}.pdf`;
        link.click();
      });
  }

  async function handleDelete(student) {
    const ok = await confirm({
      title: `Delete ${student.firstName} ${student.lastName}?`,
      message:
        "This can't be undone. If marks have already been recorded for this student, deletion will be blocked to protect that data.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/students/${student.id}`);
      await loadStudents(selectedClassId);
    } catch (err) {
      const blockedByMarks = err.code === "STUDENT_HAS_MARKS";
      notify({
        title: blockedByMarks ? "Can't delete this student" : "Delete failed",
        message: err.message,
        tone: blockedByMarks ? "warning" : "error",
      });
    }
  }

  return (
    <div>
      <ArchivedYearBanner />
      <div className="flex justify-end gap-2 mb-6">
        {isCurrentView && (
          <>
            <Button variant="secondary" onClick={openPull} disabled={!selectedClassId}>
              <CopyPlus size={16} /> Pull Students
            </Button>
            <Button onClick={openCreate} disabled={!selectedClassId}>
              <Plus size={16} /> Enroll Student
            </Button>
          </>
        )}
      </div>

      <Card>
        <Field label="Class" className="max-w-xs">
          <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {selectedClassId && (
        <Card
          title={`Students in ${selectedClass?.name || ""}`}
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by name, ID, or guardian..."
                className="w-full sm:w-64"
              />
              <Button size="sm" variant="teal" onClick={downloadStudentListPdf} disabled={students.length === 0}>
                <FileDown size={14} /> Download List (PDF)
              </Button>
            </div>
          }
        >
          <Table>
            <Thead>
              <tr>
                <SortableTh sortKey="admissionNumber" sort={sort} onSort={toggleSort}>Student ID</SortableTh>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>Name</SortableTh>
                <SortableTh sortKey="dob" sort={sort} onSort={toggleSort}>DOB</SortableTh>
                <SortableTh sortKey="sex" sort={sort} onSort={toggleSort}>Sex</SortableTh>
                <SortableTh sortKey="guardian" sort={sort} onSort={toggleSort}>Guardian</SortableTh>
                <Th className="text-right">Actions</Th>
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
                <EmptyRow colSpan={6}>No students match "{query}".</EmptyRow>
              )}
              {pagedStudents.map((s) => (
                <tr key={s.id}>
                  <Td className="font-mono text-slate-500">{s.admissionNumber || "-"}</Td>
                  <Td className="font-medium text-slate-800">
                    {s.firstName} {s.lastName}
                  </Td>
                  <Td>{formatDob(s.dob)}</Td>
                  <Td>{sexLabel(s.sex)}</Td>
                  <Td>
                    {s.guardianName ? (
                      <div>
                        <div>{s.guardianName}</div>
                        {s.guardianPhone && (
                          <div className="text-xs text-slate-400">{s.guardianPhone}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </Td>
                  <Td>
                    {isCurrentView ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-400">Read-only</div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} pageSize={pageSize} />
        </Card>
      )}

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
            <IconSelect icon={Layers} value={formClassId} onChange={(e) => setFormClassId(e.target.value)}>
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </IconSelect>
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
                  <option value="">Select year (all years shown)</option>
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
                <IconSelect
                  icon={Layers}
                  value={pullSourceClassId}
                  onChange={(e) => setPullSourceClassId(e.target.value)}
                  disabled={!pullSourceYearId}
                >
                  <option value="">Select class</option>
                  {pullSourceClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </IconSelect>
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
    </div>
  );
}
