import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { Field, Input } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import {
  KeyRound,
  Plus,
  Users,
  Ban,
  CheckCircle2,
  Eye,
  BookOpen,
  Layers,
  Trash2,
  AlertTriangle,
  ShieldOff,
  UserPlus,
  User,
  Mail,
  Phone,
} from "lucide-react";

const emptyForm = { name: "", email: "", phone: "" };

export default function Teachers() {
  const confirm = useConfirm();
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [assignmentsModal, setAssignmentsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null); // teacher being considered for deletion
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [tempPasswordError, setTempPasswordError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    const [teachersRes, assignmentsRes] = await Promise.all([
      api.get("/teachers"),
      api.get("/assignments"),
    ]);
    setTeachers(teachersRes.data.teachers);
    setAssignments(assignmentsRes.data.assignments);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setCreating(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await api.post("/teachers", form);
      setCreating(false);
      setForm(emptyForm);
      await load();
      setCredentialsModal({ email: data.teacher.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Recovers a teacher's temporary password — useful when it was forgotten or
  // never got handed over. Only works until the teacher changes it themselves,
  // at which point it's cleared server-side and this returns a 404.
  async function viewTempPassword(teacher) {
    setTempPasswordError("");
    try {
      const { data } = await api.get(`/teachers/${teacher.id}/temp-password`);
      setCredentialsModal({ email: teacher.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setTempPasswordError(err.message);
    }
  }

  // Issues a brand new temporary password — for when a teacher already
  // changed their password once (so nothing is left to recover) but has now
  // forgotten that one too.
  async function resetPassword(teacher) {
    const ok = await confirm({
      title: "Reset this teacher's password?",
      message: `${teacher.name} will be signed out and must log in with a new temporary password, then set their own.`,
      confirmText: "Reset password",
      tone: "danger",
    });
    if (!ok) return;
    setTempPasswordError("");
    try {
      const { data } = await api.post(`/teachers/${teacher.id}/reset-password`);
      await load();
      setCredentialsModal({ email: teacher.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setTempPasswordError(err.message);
    }
  }

  async function handleToggleStatus(teacher) {
    const deactivating = teacher.status === "active";
    const teacherAssignments = assignmentsFor(teacher.id);

    let message = deactivating
      ? `${teacher.name} will be signed out and unable to log in until reactivated.`
      : `${teacher.name} will regain access to their account.`;

    // Deactivation happens immediately regardless (a departed teacher's
    // access shouldn't wait on admin cleanup), but if they still hold
    // assignments, surface that here so it isn't silently forgotten —
    // reassigning is a deliberate call for the manager to make on the
    // Assignments page, not something we should do automatically.
    if (deactivating && teacherAssignments.length > 0) {
      const list = teacherAssignments
        .map((a) => `${a.Module?.moduleTitle} — ${a.Class?.name}`)
        .join(", ");
      message += ` They still teach: ${list}. Reassign these from the Assignments page afterward.`;
    }

    const ok = await confirm({
      title: deactivating ? "Deactivate this teacher?" : "Activate this teacher?",
      message,
      confirmText: deactivating ? "Deactivate" : "Activate",
      tone: deactivating ? "danger" : "primary",
    });
    if (!ok) return;
    setError("");
    try {
      await api.patch(`/teachers/${teacher.id}/status`, {
        status: deactivating ? "suspended" : "active",
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openDeleteModal(teacher) {
    setDeleteError("");
    setDeleteModal(teacher);
  }

  async function confirmDeleteTeacher() {
    if (!deleteModal) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await api.delete(`/teachers/${deleteModal.id}`);
      setDeleteModal(null);
      await load();
    } catch (err) {
      // Keep the modal open and show the reason inline (e.g. "has recorded
      // 12 marks and can't be deleted...") instead of a generic top-of-page
      // banner, so the explanation sits right next to the action that failed.
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function assignmentsFor(teacherId) {
    return assignments.filter((a) => a.teacherId === teacherId);
  }

  const filteredTeachers = teachers.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.email].filter(Boolean).some((field) => field.toLowerCase().includes(q));
  });

  const { pageItems: pagedTeachers, page, setPage, totalPages, total, pageSize } =
    usePagination(filteredTeachers, 8);

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Teacher
        </Button>
      </div>

      <Card
        title="All Teachers"
        subtitle="Modules & classes shown below are managed from the Assignments page."
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name or email..."
            className="w-full sm:w-64"
          />
        }
      >
        <ErrorText>{tempPasswordError}</ErrorText>
        <ErrorText>{error}</ErrorText>
        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Credentials</Th>
              <Th>Teaching</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {teachers.length === 0 && (
              <EmptyRow colSpan={5}>
                <div className="flex flex-col items-center gap-2 py-2">
                  <Users size={22} className="text-slate-300" />
                  No teachers yet. Click "New Teacher" to create one.
                </div>
              </EmptyRow>
            )}
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <EmptyRow colSpan={5}>No teachers match "{query}".</EmptyRow>
            )}
            {pagedTeachers.map((t) => {
              const teacherAssignments = assignmentsFor(t.id);
              return (
                <tr key={t.id}>
                  <Td className="align-top">
                    <p className="font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]" title={t.email}>
                      {t.email}
                    </p>
                  </Td>
                  <Td className="align-top whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={t.status === "active" ? "pass" : "fail"}>{t.status}</Badge>
                      {t.status !== "active" && teacherAssignments.length > 0 && (
                        <span
                          className="text-[11px] font-medium text-amber-600"
                          title="Reassign these from the Assignments page"
                        >
                          {teacherAssignments.length} unresolved assignment
                          {teacherAssignments.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="align-top whitespace-nowrap">
                    {t.tempPasswordSetAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewTempPassword(t)}
                        title="View temporary password"
                      >
                        <KeyRound size={14} /> View
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Password changed</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetPassword(t)}
                          title="Issue a new temporary password"
                        >
                          <KeyRound size={14} /> Reset
                        </Button>
                      </div>
                    )}
                  </Td>
                  <Td className="align-top min-w-[140px]">
                    {teacherAssignments.length === 0 ? (
                      <span className="text-slate-400 text-sm">No assignments yet</span>
                    ) : (
                      <button
                        onClick={() => setAssignmentsModal(t)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white pl-2.5 pr-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
                        title="View all taught modules"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                          <Eye size={13} />
                        </span>
                        <span className="font-medium">
                          {teacherAssignments.length} module{teacherAssignments.length > 1 ? "s" : ""}
                        </span>
                      </button>
                    )}
                  </Td>
                  <Td className="align-top whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={t.status === "active" ? "danger" : "primary"}
                        onClick={() => handleToggleStatus(t)}
                        title={t.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {t.status === "active" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteModal(t)}
                        title="Delete teacher"
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} pageSize={pageSize} />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Teacher Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Teacher"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreate} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-brand-500 flex items-center justify-center">
              <UserPlus size={17} className="text-white" />
            </div>
            <p className="text-xs text-brand-700 leading-snug">
              A temporary password will be generated automatically — you'll be able to share it
              with the teacher after creating the account.
            </p>
          </div>

          <Field label="Full Name">
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Jane Uwimana"
                className="pl-9"
                required
                autoFocus
              />
            </div>
          </Field>
          <Field label="Email">
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="teacher@school.com"
                className="pl-9"
                required
              />
            </div>
          </Field>
          <Field label="Phone">
            <div className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Optional"
                className="pl-9"
              />
            </div>
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Teacher account created"
        footer={<Button onClick={() => setCredentialsModal(null)}>Done</Button>}
      >
        <p className="text-sm text-slate-600 mb-3">Share these temporary credentials with the teacher.</p>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
          <p>
            <span className="text-slate-500">Email:</span>{" "}
            <span className="font-medium text-slate-800">{credentialsModal?.email}</span>
          </p>
          <p>
            <span className="text-slate-500">Temporary password:</span>{" "}
            <code className="bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono text-brand-600">
              {credentialsModal?.temporaryPassword}
            </code>
          </p>
        </div>
      </Modal>
      <Modal
        open={!!assignmentsModal}
        onClose={() => setAssignmentsModal(null)}
        title={assignmentsModal ? `${assignmentsModal.name} — Teaching` : ""}
        size="lg"
        footer={<Button onClick={() => setAssignmentsModal(null)}>Close</Button>}
      >
        {assignmentsModal && (() => {
          const list = assignmentsFor(assignmentsModal.id);
          const byClass = list.reduce((map, a) => {
            const key = a.Class?.name || "Unassigned Class";
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(a);
            return map;
          }, new Map());

          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-sm text-brand-700">
                <BookOpen size={15} />
                <span>
                  Teaching <span className="font-semibold">{list.length}</span> module{list.length !== 1 ? "s" : ""}{" "}
                  across <span className="font-semibold">{byClass.size}</span> class{byClass.size !== 1 ? "es" : ""}
                </span>
              </div>
              {[...byClass.entries()].map(([className, mods]) => (
                <div key={className}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    <Layers size={13} /> {className}
                  </div>
                  <div className="flex flex-col gap-2">
                    {mods.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{a.Module?.moduleTitle}</p>
                          {a.Module?.moduleCode && (
                            <p className="text-xs text-slate-400">{a.Module.moduleCode}</p>
                          )}
                        </div>
                        {a.Module?.moduleWeight !== undefined && (
                          <Badge tone="manager" className="shrink-0">
                            Weight {a.Module.moduleWeight}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={!!deleteModal}
        onClose={() => (deleting ? null : setDeleteModal(null))}
        title="Delete teacher account"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteTeacher} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Teacher"}
            </Button>
          </>
        }
      >
        {deleteModal && (() => {
          const teacherAssignments = assignmentsFor(deleteModal.id);
          return (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    You're about to permanently delete{" "}
                    <span className="font-semibold text-slate-900">{deleteModal.name}</span>'s account.
                  </p>
                  <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
                </div>
              </div>

              <ul className="space-y-2 rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Blocked automatically if this teacher has recorded any marks.</span>
                </li>
                {teacherAssignments.length > 0 && (
                  <li className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>
                      Currently teaches <span className="font-medium text-slate-800">{teacherAssignments.length}</span>{" "}
                      module{teacherAssignments.length > 1 ? "s" : ""} — these assignments will be cleared.
                    </span>
                  </li>
                )}
                <li className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>Their login access ends immediately.</span>
                </li>
              </ul>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <ShieldOff size={16} className="shrink-0 mt-0.5" />
                <span>
                  If you just need to revoke access without losing their history, use{" "}
                  <span className="font-medium">Deactivate</span> instead — it's reversible.
                </span>
              </div>

              <ErrorText>{deleteError}</ErrorText>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
