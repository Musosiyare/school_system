import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import {
  KeyRound,
  Ban,
  CheckCircle2,
  Plus,
  School as SchoolIcon,
  MapPin,
  Users,
  GraduationCap,
  Layers,
  ShieldCheck,
  Mail,
  Phone,
  UserCircle2,
} from "lucide-react";

const emptyForm = {
  name: "",
  email: "",
  address: "",
  phone: "",
  managerName: "",
  managerEmail: "",
  managerPhone: "",
};

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function SuperuserDashboard() {
  const confirm = useConfirm();
  const [schools, setSchools] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentialsModal, setCredentialsModal] = useState(null); // { email, temporaryPassword, heading }
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");

  async function loadSchools() {
    const { data } = await api.get("/schools");
    setSchools(data.schools);
  }

  async function loadStats() {
    try {
      const { data } = await api.get("/schools/stats");
      setStats(data);
    } catch (err) {
      setStatsError(err.message);
    }
  }

  useEffect(() => {
    loadSchools();
    loadStats();
  }, []);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setCreating(true);
  }

  async function handleCreateSchool(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/schools", {
        name: form.name,
        email: form.email,
        address: form.address,
        phone: form.phone,
        manager: { name: form.managerName, email: form.managerEmail, phone: form.managerPhone },
      });
      setCreating(false);
      setForm(emptyForm);
      await loadSchools();
      await loadStats();
      setCredentialsModal({
        heading: `${data.school.name} created`,
        email: data.manager.email,
        temporaryPassword: data.manager.temporaryPassword,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(school) {
    const suspending = school.status === "active";
    const ok = await confirm({
      title: suspending ? "Suspend this school?" : "Reactivate this school?",
      message: suspending
        ? `${school.name} will lose access immediately. Staff will be unable to log in until reactivated.`
        : `${school.name} will regain full access.`,
      confirmText: suspending ? "Suspend" : "Activate",
      tone: suspending ? "danger" : "primary",
    });
    if (!ok) return;
    setListError("");
    try {
      await api.patch(`/schools/${school.id}`, { status: suspending ? "suspended" : "active" });
      await loadSchools();
      await loadStats();
    } catch (err) {
      setListError(err.message);
    }
  }

  async function viewTempPassword(school) {
    setListError("");
    try {
      const { data } = await api.get(`/schools/${school.id}/manager-temp-password`);
      setCredentialsModal({
        heading: `Manager credentials — ${school.name}`,
        email: data.manager.email,
        temporaryPassword: data.temporaryPassword,
      });
    } catch (err) {
      setListError(err.message);
    }
  }

  const filteredSchools = schools.filter((s) => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.address, s.phone, s.email, s.managerName, s.managerEmail, s.managerPhone]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New School
        </Button>
      </div>

      <ErrorText>{statsError}</ErrorText>

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              icon={<SchoolIcon size={18} />}
              label="Schools"
              value={stats.totals.totalSchools}
              sub={`${stats.totals.activeSchools} active · ${stats.totals.suspendedSchools} suspended`}
            />
            <StatCard
              icon={<ShieldCheck size={18} />}
              label="Managers"
              value={stats.totals.totalManagers}
              sub={`${stats.totals.activeManagers} active`}
            />
            <StatCard
              icon={<Users size={18} />}
              label="Teachers"
              value={stats.totals.totalTeachers}
              sub={`${stats.totals.activeTeachers} active`}
            />
            <StatCard
              icon={<GraduationCap size={18} />}
              label="Students"
              value={stats.totals.totalStudents}
              sub={`${stats.totals.activeStudents} active`}
            />
            <StatCard icon={<Layers size={18} />} label="Classes" value={stats.totals.totalClasses} />
          </div>

          <Card title="Per-School Breakdown">
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>School</Th>
                    <Th>Status</Th>
                    <Th>Active Teachers</Th>
                    <Th>Active Students</Th>
                    <Th>Classes</Th>
                  </tr>
                </Thead>
                <tbody>
                  {stats.perSchool.length === 0 && (
                    <EmptyRow colSpan={5}>No schools registered yet.</EmptyRow>
                  )}
                  {stats.perSchool.map((row) => (
                    <tr key={row.id}>
                      <Td className="font-medium text-slate-800">{row.name}</Td>
                      <Td>
                        <Badge tone={row.status === "active" ? "pass" : "fail"}>{row.status}</Badge>
                      </Td>
                      <Td>{row.activeTeachers}</Td>
                      <Td>{row.activeStudents}</Td>
                      <Td>{row.classes}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <Card
        title="All Schools"
        actions={
          <SearchInput
            value={schoolQuery}
            onChange={setSchoolQuery}
            placeholder="Search by school, manager, or email..."
            className="w-64"
          />
        }
      >
        <ErrorText>{listError}</ErrorText>

        {schools.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400 text-sm">
            <SchoolIcon size={22} className="text-slate-300" />
            No schools registered yet. Click "New School" to create one.
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No schools match "{schoolQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSchools.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate" title={s.name}>
                      {s.name}
                    </p>
                    {s.address && (
                      <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </p>
                    )}
                  </div>
                  <Badge tone={s.status === "active" ? "pass" : "fail"} className="shrink-0">
                    {s.status}
                  </Badge>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    School Contact
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600 min-w-0">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.phone || <span className="text-slate-400">Not provided</span>}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600 min-w-0">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.email || <span className="text-slate-400">—</span>}</span>
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Manager Contact
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-700 min-w-0">
                    <UserCircle2 size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.managerName || <span className="text-slate-400">No manager name</span>}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600 min-w-0">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.managerEmail || <span className="text-slate-400">—</span>}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-600 min-w-0">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.managerPhone || <span className="text-slate-400">Not provided</span>}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  {s.managerHasTempPassword ? (
                    <Button size="sm" variant="ghost" onClick={() => viewTempPassword(s)}>
                      <KeyRound size={14} /> Temp password
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">Password changed</span>
                  )}
                  <Button
                    size="sm"
                    variant={s.status === "active" ? "danger" : "primary"}
                    onClick={() => handleToggleStatus(s)}
                  >
                    {s.status === "active" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                    {s.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Register a New School"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSchool} disabled={submitting}>
              {submitting ? "Creating..." : "Create School"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreateSchool} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <p className="sm:col-span-2 text-sm text-slate-500 -mt-1">
            This creates the school and its first Manager account.
          </p>
          <Field label="School Name">
            <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} required autoFocus />
          </Field>
          <Field label="School Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </Field>
          <Field label="Location / Address">
            <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
          </Field>
          <Field label="School Phone">
            <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </Field>
          <Field label="First Manager Name">
            <Input value={form.managerName} onChange={(e) => updateField("managerName", e.target.value)} required />
          </Field>
          <Field label="First Manager Email">
            <Input
              type="email"
              value={form.managerEmail}
              onChange={(e) => updateField("managerEmail", e.target.value)}
              required
            />
          </Field>
          <Field label="First Manager Phone">
            <Input value={form.managerPhone} onChange={(e) => updateField("managerPhone", e.target.value)} />
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title={credentialsModal?.heading}
        footer={<Button onClick={() => setCredentialsModal(null)}>Done</Button>}
      >
        <p className="text-sm text-slate-600 mb-3">
          Share these temporary credentials with the manager. They'll be required to set a new
          password on first login.
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
