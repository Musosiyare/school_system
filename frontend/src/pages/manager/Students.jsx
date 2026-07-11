import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import { Plus, GraduationCap, Pencil, Trash2, FileDown } from "lucide-react";

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
    const { data } = await api.get("/classes");
    setClasses(data.classes);
  }

  async function loadStudents(classId) {
    if (!classId) return setStudents([]);
    const { data } = await api.get(`/classes/${classId}/students`);
    setStudents(data.students);
  }

  useEffect(() => {
    loadClasses();
  }, []);

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
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate} disabled={!selectedClassId}>
          <Plus size={16} /> Enroll Student
        </Button>
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
            <div className="flex items-center gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search by name, ID, or guardian..."
                className="w-64"
              />
              <Button size="sm" variant="ghost" onClick={downloadStudentListPdf} disabled={students.length === 0}>
                <FileDown size={14} /> Download List (PDF)
              </Button>
            </div>
          }
        >
          <Table>
            <Thead>
              <tr>
                <Th>Student ID</Th>
                <Th>Name</Th>
                <Th>DOB</Th>
                <Th>Sex</Th>
                <Th>Guardian</Th>
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
              {filteredStudents.map((s) => (
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
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded hover:bg-green-50 text-green-600"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
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
        <form noValidate onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <Field label="Class" className="col-span-2 max-w-xs">
            <Select value={formClassId} onChange={(e) => setFormClassId(e.target.value)}>
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="First Name">
            <Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} required autoFocus />
          </Field>
          <Field label="Last Name">
            <Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} required />
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
          </Field>
          <Field label="Sex">
            <Select value={form.sex} onChange={(e) => updateField("sex", e.target.value)}>
              <option value="">Select...</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </Select>
          </Field>
          <Field label="Guardian Name">
            <Input value={form.guardianName} onChange={(e) => updateField("guardianName", e.target.value)} />
          </Field>
          <Field label="Guardian Phone">
            <Input value={form.guardianPhone} onChange={(e) => updateField("guardianPhone", e.target.value)} />
          </Field>
          {!editingStudent && (
            <div className="col-span-2 text-xs text-slate-400">
              A 6-digit Student ID is generated automatically once you enroll this student.
            </div>
          )}
          <div className="col-span-2">
            <ErrorText>{error}</ErrorText>
          </div>
        </form>
      </Modal>
    </div>
  );
}
