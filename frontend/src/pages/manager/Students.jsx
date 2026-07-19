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
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import { Plus, GraduationCap, Pencil, Trash2, FileDown, User, UserCircle2, Phone, Cake, Layers } from "lucide-react";

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
      <div className="flex justify-end mb-6">
        {isCurrentView && (
          <Button onClick={openCreate} disabled={!selectedClassId}>
            <Plus size={16} /> Enroll Student
          </Button>
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
    </div>
  );
}
