import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { ShieldAlert, Plus, KeyRound, Ban, CheckCircle2, UserCog, UserPlus } from "lucide-react";

const ROLE_LABEL = { dean_of_discipline: "Dean of Discipline", disciplinary_officer: "Disciplinary Officer" };
const emptyForm = { name: "", email: "", phone: "", disciplineRole: "disciplinary_officer" };

/**
 * A dedicated place to create and manage accounts for SBMS (the discipline
 * companion app) — kept separate from the general Teachers roster since
 * most teachers never need an SBMS role, and mixing the two made every
 * teacher row noisier for no reason. These are still ordinary accounts in
 * this system (same login, same `users` table) — this page is just a
 * focused view over the ones that also have a discipline role.
 */
export default function DisciplinaryStaff() {
  const confirm = useConfirm();
  const [staff, setStaff] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [tempPasswordError, setTempPasswordError] = useState("");
  const [roleModal, setRoleModal] = useState(null); // person whose role is being changed
  const [roleModalValue, setRoleModalValue] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [promoting, setPromoting] = useState(false); // "New discipline staff from teachers" modal open
  const [teachers, setTeachers] = useState(null);
  const [promoteTeacherId, setPromoteTeacherId] = useState("");
  const [promoteRole, setPromoteRole] = useState("disciplinary_officer");
  const [promoteSaving, setPromoteSaving] = useState(false);
  const [promoteError, setPromoteError] = useState("");

  async function load() {
    const { data } = await api.get("/teachers/disciplinary-staff");
    setStaff(data.staff);
  }

  useEffect(() => {
    load();
  }, []);

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
      const { data } = await api.post("/teachers", { ...form, disciplineOnly: true });
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

  function openRoleModal(person) {
    setRoleModal(person);
    setRoleModalValue(person.disciplineRole || "");
    setError("");
  }

  async function handleRoleModalSubmit(e) {
    e.preventDefault();
    const removing = !roleModalValue && roleModal.disciplineRole;
    if (removing) {
      const ok = await confirm({
        title: "Remove SBMS access?",
        message: `${roleModal.name} will lose ${ROLE_LABEL[roleModal.disciplineRole]} access in SBMS. Their regular login and any teaching duties are unaffected.`,
        confirmText: "Remove access",
        tone: "danger",
      });
      if (!ok) return;
    }
    setRoleSaving(true);
    setError("");
    try {
      await api.patch(`/teachers/${roleModal.id}/discipline-role`, { disciplineRole: roleModalValue || null });
      setRoleModal(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRoleSaving(false);
    }
  }

  async function openPromoteModal() {
    setPromoteError("");
    setPromoteTeacherId("");
    setPromoteRole("disciplinary_officer");
    setPromoting(true);
    if (!teachers) {
      const { data } = await api.get("/teachers");
      setTeachers(data.teachers);
    }
  }

  async function handlePromoteSubmit(e) {
    e.preventDefault();
    setPromoteError("");
    if (!promoteTeacherId) {
      setPromoteError("Pick a teacher.");
      return;
    }
    setPromoteSaving(true);
    try {
      await api.patch(`/teachers/${promoteTeacherId}/discipline-role`, { disciplineRole: promoteRole });
      setPromoting(false);
      await load();
    } catch (err) {
      setPromoteError(err.message);
    } finally {
      setPromoteSaving(false);
    }
  }

  async function toggleStatus(person) {
    const deactivating = person.status === "active";
    const ok = await confirm({
      title: deactivating ? "Deactivate this account?" : "Activate this account?",
      message: deactivating
        ? `${person.name} will no longer be able to log into SBMS or this system.`
        : `${person.name} will be able to log in again.`,
      confirmText: deactivating ? "Deactivate" : "Activate",
      tone: deactivating ? "danger" : "primary",
    });
    if (!ok) return;
    try {
      await api.patch(`/teachers/${person.id}/status`, { status: deactivating ? "suspended" : "active" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewTempPassword(person) {
    setTempPasswordError("");
    try {
      const { data } = await api.get(`/teachers/${person.id}/temp-password`);
      setCredentialsModal({ email: person.email, temporaryPassword: data.temporaryPassword });
    } catch (err) {
      setTempPasswordError(err.message);
    }
  }

  return (
    <div>
      <Card
        title="Disciplinary staff"
        subtitle="Dean of Discipline and Disciplinary Officer (patron/matron) accounts — used to log into SBMS."
        actions={
          <>
            <Button variant="secondary" onClick={openPromoteModal}>
              <UserPlus size={15} /> New discipline staff from teachers
            </Button>
            <Button onClick={openCreate}>
              <Plus size={15} /> New disciplinary staff
            </Button>
          </>
        }
      >
        <ErrorText>{error || tempPasswordError}</ErrorText>

        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>SBMS role</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {staff === null ? (
              <EmptyRow colSpan={6}>Loading...</EmptyRow>
            ) : staff.length === 0 ? (
              <EmptyRow colSpan={6}>
                <div className="flex flex-col items-center gap-2 py-2">
                  <ShieldAlert size={22} className="text-slate-300" />
                  No disciplinary staff yet. Click "New disciplinary staff" to add one.
                </div>
              </EmptyRow>
            ) : (
              staff.map((person) => (
                <tr key={person.id}>
                  <Td>{person.name}</Td>
                  <Td>{person.email}</Td>
                  <Td>
                    {person.role === "teacher" ? (
                      <Badge tone="teal">Also teaches</Badge>
                    ) : (
                      <Badge tone="neutral">Discipline only</Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={person.status === "active" ? "pass" : "fail"}>
                      {person.status === "active" ? "Active" : "Suspended"}
                    </Badge>
                  </Td>
                  <Td>
                    {person.disciplineRole ? (
                      <Badge tone="manager">{ROLE_LABEL[person.disciplineRole]}</Badge>
                    ) : (
                      <Badge tone="neutral">No SBMS role</Badge>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openRoleModal(person)}
                        title={person.disciplineRole ? "Change or remove SBMS role" : "Assign SBMS role"}
                      >
                        <UserCog size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => viewTempPassword(person)} title="View credentials">
                        <KeyRound size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant={person.status === "active" ? "danger" : "primary"}
                        onClick={() => toggleStatus(person)}
                        title={person.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {person.status === "active" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="New disciplinary staff" size="md">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 -mt-1 flex items-start gap-2">
            <UserCog size={15} className="shrink-0 mt-0.5 text-slate-400" />
            This creates a regular account in this system — the same kind a teacher has — with an SBMS role attached.
            They don't need to teach any classes.
          </p>
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </Field>
          <Field label="Phone (optional)">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="SBMS role">
            <Select
              value={form.disciplineRole}
              onChange={(e) => setForm((f) => ({ ...f, disciplineRole: e.target.value }))}
            >
              <option value="disciplinary_officer">Disciplinary Officer (patron/matron)</option>
              <option value="dean_of_discipline">Dean of Discipline</option>
            </Select>
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create account"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title="Change SBMS role" size="sm">
        {roleModal && (
          <form onSubmit={handleRoleModalSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-slate-500">{roleModal.name}</p>
            <Field label="SBMS role">
              <Select value={roleModalValue} onChange={(e) => setRoleModalValue(e.target.value)}>
                <option value="dean_of_discipline">Dean of Discipline</option>
                <option value="disciplinary_officer">Disciplinary Officer</option>
                <option value="">Remove SBMS access</option>
              </Select>
            </Field>
            <ErrorText>{error}</ErrorText>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRoleModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={roleModalValue ? "primary" : "danger"} disabled={roleSaving}>
                {roleSaving ? "Saving..." : roleModalValue ? "Save" : "Remove access"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={promoting} onClose={() => setPromoting(false)} title="New discipline staff from teachers" size="sm">
        <form onSubmit={handlePromoteSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 -mt-1">
            Pick an existing teacher and give them an SBMS role. They keep their teaching duties and still appear on
            the Teachers page — this just adds SBMS access on top, using the same login.
          </p>
          <Field label="Teacher">
            <Select value={promoteTeacherId} onChange={(e) => setPromoteTeacherId(e.target.value)} disabled={!teachers}>
              <option value="">{teachers ? "Select..." : "Loading..."}</option>
              {teachers
                ?.filter((t) => !t.disciplineRole)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="SBMS role">
            <Select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)}>
              <option value="disciplinary_officer">Disciplinary Officer (patron/matron)</option>
              <option value="dean_of_discipline">Dean of Discipline</option>
            </Select>
          </Field>
          <ErrorText>{promoteError}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPromoting(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={promoteSaving}>
              {promoteSaving ? "Saving..." : "Assign role"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Account credentials"
        footer={<Button onClick={() => setCredentialsModal(null)}>Done</Button>}
      >
        <p className="text-sm text-slate-600 mb-3">
          Share these with them — they'll use this same email and password to log into SBMS.
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
    </div>
  );
}
