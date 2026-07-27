import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { useSort } from "../../hooks/useSort";
import { Field, Input, Select } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, SortableTh, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import {
  KeyRound,
  Plus,
  ShieldAlert,
  Tag,
  Trash2,
  AlertTriangle,
  ShieldOff,
  User,
  Mail,
  Phone,
  Pencil,
  Info,
} from "lucide-react";

const emptyForm = { name: "", email: "", phone: "", disciplineRole: "dean_of_discipline" };

const ROLE_LABEL = {
  dean_of_discipline: "Dean of Discipline",
  disciplinary_officer: "Disciplinary Officer",
};

export default function DisciplineStaff() {
  const confirm = useConfirm();

  // Standalone SBMS-only accounts
  const [staff, setStaff] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [tempPasswordError, setTempPasswordError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // Tagging existing teachers/managers
  const [taggable, setTaggable] = useState([]);
  const [tagError, setTagError] = useState("");

  async function load() {
    const [staffRes, taggableRes] = await Promise.all([
      api.get("/discipline-staff"),
      api.get("/discipline-staff/taggable"),
    ]);
    setStaff(staffRes.data.staff);
    setTaggable(taggableRes.data.staff);
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
      const { data } = await api.post("/discipline-staff", form);
      setCreating(false);
      setForm(emptyForm);
      await load();
      setCredentialsModal({ email: data.staff.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewTempPassword(person) {
    setTempPasswordError("");
    try {
      const { data } = await api.get(`/discipline-staff/${person.id}/temp-password`);
      setCredentialsModal({ email: person.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setTempPasswordError(err.message);
    }
  }

  async function resetPassword(person) {
    const ok = await confirm({
      title: "Reset this account's password?",
      message: `${person.name} will need to log in to SBMS with a new temporary password, then set their own.`,
      confirmText: "Reset password",
      tone: "danger",
    });
    if (!ok) return;
    setTempPasswordError("");
    try {
      const { data } = await api.post(`/discipline-staff/${person.id}/reset-password`);
      await load();
      setCredentialsModal({ email: person.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setTempPasswordError(err.message);
    }
  }

  async function handleToggleStatus(person) {
    const deactivating = person.status === "active";
    const ok = await confirm({
      title: deactivating ? "Deactivate this account?" : "Activate this account?",
      message: deactivating
        ? `${person.name} will lose SBMS access until reactivated.`
        : `${person.name} will regain SBMS access.`,
      confirmText: deactivating ? "Deactivate" : "Activate",
      tone: deactivating ? "danger" : "primary",
    });
    if (!ok) return;
    setError("");
    try {
      await api.patch(`/discipline-staff/${person.id}/status`, {
        status: deactivating ? "suspended" : "active",
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleChange(person, disciplineRole) {
    setError("");
    try {
      await api.patch(`/discipline-staff/${person.id}/role`, { disciplineRole });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEditModal(person) {
    setEditForm({ name: person.name || "", email: person.email || "", phone: person.phone || "" });
    setEditError("");
    setEditModal(person);
  }

  function updateEditField(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editModal) return;
    setEditError("");
    setEditSaving(true);
    try {
      await api.patch(`/discipline-staff/${editModal.id}`, editForm);
      setEditModal(null);
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteModal(person) {
    setDeleteError("");
    setDeleteModal(person);
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await api.delete(`/discipline-staff/${deleteModal.id}`);
      setDeleteModal(null);
      await load();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Tagging existing teacher/manager accounts
  async function handleTagChange(person, disciplineRole) {
    setTagError("");
    try {
      await api.patch(`/discipline-staff/tag/${person.id}`, { disciplineRole: disciplineRole || null });
      await load();
    } catch (err) {
      setTagError(err.message);
    }
  }

  const filteredStaff = staff.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.email].filter(Boolean).some((field) => field.toLowerCase().includes(q));
  });

  const { sorted: sortedStaff, sort, toggleSort } = useSort(filteredStaff, {
    name: (s) => s.name?.toLowerCase(),
    status: (s) => s.status,
    role: (s) => s.disciplineRole,
  });

  const { pageItems: pagedStaff, page, setPage, totalPages, total, pageSize } =
    usePagination(sortedStaff, 8);

  const taggedStaff = taggable.filter((t) => t.disciplineRole);
  const untaggedStaff = taggable.filter((t) => !t.disciplineRole);

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Disciplinary Staff
        </Button>
      </div>

      <Card
        title="Standalone SBMS Accounts"
        subtitle="People with no teaching or management role here — they exist only to use SBMS."
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name or email..."
            className="w-full sm:w-64"
          />
        }
      >
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>
            These accounts can't log in to this system — their credentials are only checked by SBMS.
            To give an existing teacher or manager SBMS access instead, use "Tag Existing Staff" below.
          </span>
        </div>
        <ErrorText>{tempPasswordError}</ErrorText>
        <ErrorText>{error}</ErrorText>
        <Table>
          <Thead>
            <tr>
              <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>Name</SortableTh>
              <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>Status</SortableTh>
              <Th>Credentials</Th>
              <SortableTh sortKey="role" sort={sort} onSort={toggleSort}>SBMS role</SortableTh>
              <Th className="text-right">Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {staff.length === 0 && (
              <EmptyRow colSpan={5}>
                <div className="flex flex-col items-center gap-2 py-2">
                  <ShieldAlert size={22} className="text-slate-300" />
                  No standalone SBMS accounts yet. Click "New Disciplinary Staff" to create one.
                </div>
              </EmptyRow>
            )}
            {staff.length > 0 && filteredStaff.length === 0 && (
              <EmptyRow colSpan={5}>No accounts match "{query}".</EmptyRow>
            )}
            {pagedStaff.map((s) => (
              <tr key={s.id}>
                <Td className="align-top">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400 truncate max-w-[180px]" title={s.email}>
                    {s.email}
                  </p>
                </Td>
                <Td className="align-top whitespace-nowrap">
                  <Badge tone={s.status === "active" ? "pass" : "fail"}>{s.status}</Badge>
                </Td>
                <Td className="align-top whitespace-nowrap">
                  {s.tempPasswordSetAt ? (
                    <Button size="sm" variant="ghost" onClick={() => viewTempPassword(s)} title="View temporary password">
                      <KeyRound size={14} /> View
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Password changed</span>
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(s)} title="Issue a new temporary password">
                        <KeyRound size={14} /> Reset
                      </Button>
                    </div>
                  )}
                </Td>
                <Td className="align-top min-w-[170px]">
                  <Select
                    value={s.disciplineRole || ""}
                    onChange={(e) => handleRoleChange(s, e.target.value)}
                    className="text-xs py-1.5"
                    title="This account's role in SBMS"
                  >
                    <option value="dean_of_discipline">Dean of Discipline</option>
                    <option value="disciplinary_officer">Disciplinary Officer</option>
                  </Select>
                </Td>
                <Td className="align-top whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(s)} title="Edit details">
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(s)} title={s.status === "active" ? "Deactivate" : "Activate"}>
                      <ShieldOff size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openDeleteModal(s)} title="Delete account">
                      <Trash2 size={14} className="text-rose-500" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} pageSize={pageSize} />
      </Card>

      <Card
        title="Tag Existing Staff"
        subtitle="Give a teacher or manager SBMS access too, without creating a separate login."
      >
        <ErrorText>{tagError}</ErrorText>
        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Role here</Th>
              <Th>SBMS role</Th>
            </tr>
          </Thead>
          <tbody>
            {taggable.length === 0 && (
              <EmptyRow colSpan={3}>No teachers or managers found.</EmptyRow>
            )}
            {[...taggedStaff, ...untaggedStaff].map((t) => (
              <tr key={t.id}>
                <Td className="align-top">
                  <p className="font-medium text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]" title={t.email}>
                    {t.email}
                  </p>
                </Td>
                <Td className="align-top whitespace-nowrap">
                  <Badge tone={t.role === "manager" ? "manager" : "teacher"}>{t.role}</Badge>
                </Td>
                <Td className="align-top min-w-[170px]">
                  <Select
                    value={t.disciplineRole || ""}
                    onChange={(e) => handleTagChange(t, e.target.value)}
                    className="text-xs py-1.5"
                    title="Assign this person's role in SBMS, or clear it"
                  >
                    <option value="">No SBMS role</option>
                    <option value="dean_of_discipline">Dean of Discipline</option>
                    <option value="disciplinary_officer">Disciplinary Officer</option>
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Create standalone account */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Disciplinary Staff"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Account"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreate} className="space-y-5">
          <Field label="Full Name">
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Jean Bosco"
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
                placeholder="staff@school.com"
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
          <Field label="SBMS Role">
            <div className="relative">
              <Tag size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
              <Select
                value={form.disciplineRole}
                onChange={(e) => updateField("disciplineRole", e.target.value)}
                className="pl-9"
                required
              >
                <option value="dean_of_discipline">Dean of Discipline</option>
                <option value="disciplinary_officer">Disciplinary Officer</option>
              </Select>
            </div>
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      {/* Edit standalone account */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="Edit Disciplinary Staff"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleUpdate} className="space-y-5">
          <Field label="Full Name">
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={editForm.name}
                onChange={(e) => updateEditField("name", e.target.value)}
                placeholder="e.g. Jean Bosco"
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
                value={editForm.email}
                onChange={(e) => updateEditField("email", e.target.value)}
                placeholder="staff@school.com"
                className="pl-9"
                required
              />
            </div>
          </Field>
          <Field label="Phone">
            <div className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={editForm.phone}
                onChange={(e) => updateEditField("phone", e.target.value)}
                placeholder="Optional"
                className="pl-9"
              />
            </div>
          </Field>
          <ErrorText>{editError}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="SBMS account credentials"
        footer={<Button onClick={() => setCredentialsModal(null)}>Done</Button>}
      >
        <p className="text-sm text-slate-600 mb-3">
          Share these temporary credentials with the staff member for logging into SBMS.
        </p>
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
        open={!!deleteModal}
        onClose={() => (deleting ? null : setDeleteModal(null))}
        title="Delete SBMS account"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Account"}
            </Button>
          </>
        }
      >
        {deleteModal && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  You're about to permanently delete{" "}
                  <span className="font-semibold text-slate-900">{deleteModal.name}</span>'s SBMS account.
                </p>
                <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <ShieldOff size={16} className="shrink-0 mt-0.5" />
              <span>
                If you just need to revoke access without losing the account, use{" "}
                <span className="font-medium">Deactivate</span> instead — it's reversible.
              </span>
            </div>
            <ErrorText>{deleteError}</ErrorText>
          </div>
        )}
      </Modal>
    </div>
  );
}
