import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Switch from "../../components/ui/Switch";
import AccordionSection from "../../components/ui/AccordionSection";
import { Field, Input, IconInput, Textarea } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useMaintenance } from "../../context/MaintenanceContext";
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
  ArrowRight,
  Wrench,
  ListChecks,
  CalendarClock,
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

function StatCard({ icon: Icon, label, value, sub, accent, onClick, clickable }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`group text-left bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-200
        ${clickable ? "hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 cursor-pointer" : "cursor-default opacity-70"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon size={18} />
        </div>
        {clickable && (
          <ArrowRight
            size={14}
            className="mt-1.5 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition"
          />
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs sm:text-sm text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </button>
  );
}

export default function SuperuserDashboard() {
  const confirm = useConfirm();
  const maintenance = useMaintenance();

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

  const [openBreakdown, setOpenBreakdown] = useState(false);
  const [openAllSchools, setOpenAllSchools] = useState(false);
  const [openMaintenance, setOpenMaintenance] = useState(false);

  const breakdownRef = useRef(null);
  const allSchoolsRef = useRef(null);
  const maintenanceRef = useRef(null);

  // --- Maintenance mode: on/off toggle (saves immediately, no draft) ---
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [maintError, setMaintError] = useState("");

  // --- Maintenance mode: message modal ---
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState({ title: "", message: "" });
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [messageError, setMessageError] = useState("");

  // --- Scheduled maintenance (separate action from the immediate on/off save above) ---
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

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

  // Issues a brand new temporary password for the school's manager — for when
  // they already changed their password once (nothing left to recover) but
  // have now forgotten that one too.
  async function resetManagerPassword(school) {
    const ok = await confirm({
      title: "Reset this manager's password?",
      message: `${school.managerName || "This manager"} will be signed out and must log in with a new temporary password, then set their own.`,
      confirmText: "Reset password",
      tone: "danger",
    });
    if (!ok) return;
    setListError("");
    try {
      const { data } = await api.post(`/schools/${school.id}/reset-manager-credentials`);
      await loadSchools();
      setCredentialsModal({
        heading: `Manager credentials — ${school.name}`,
        email: data.manager.email,
        temporaryPassword: data.manager.temporaryPassword,
      });
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

  // --- Maintenance mode actions ---

  // Flips maintenance on/off immediately — no separate "Save Changes" step.
  async function toggleMaintenanceMode(next) {
    // Extra confirmation specifically for the moment it flips ON, since it
    // immediately locks every manager and teacher on the platform out.
    if (next && !maintenance.maintenanceMode) {
      const ok = await confirm({
        title: "Enable maintenance mode?",
        message:
          "Every manager and teacher will be signed out of the app immediately and shown your message instead. You'll keep full access.",
        confirmText: "Enable maintenance mode",
        tone: "danger",
      });
      if (!ok) return;
    }

    setMaintError("");
    setToggleSubmitting(true);
    try {
      await api.patch("/settings/maintenance", {
        maintenanceMode: next,
        title: maintenance.title,
        message: maintenance.message,
      });
      await maintenance.refresh();
    } catch (err) {
      setMaintError(err.message);
    } finally {
      setToggleSubmitting(false);
    }
  }

  // --- Maintenance mode: message modal actions ---

  function openMessageModal() {
    setMessageDraft({ title: maintenance.title, message: maintenance.message });
    setMessageError("");
    setMessageModalOpen(true);
  }

  function closeMessageModal() {
    if (messageSubmitting) return;
    setMessageModalOpen(false);
  }

  function updateMessageField(field, value) {
    setMessageDraft((f) => ({ ...f, [field]: value }));
  }

  async function saveMessage() {
    if (!messageDraft.title.trim() || !messageDraft.message.trim()) {
      setMessageError("Title and message can't be empty.");
      return;
    }
    setMessageError("");
    setMessageSubmitting(true);
    try {
      await api.patch("/settings/maintenance", {
        maintenanceMode: maintenance.maintenanceMode, // leave the live on/off switch untouched
        title: messageDraft.title.trim(),
        message: messageDraft.message.trim(),
      });
      await maintenance.refresh();
      setMessageModalOpen(false);
    } catch (err) {
      setMessageError(err.message);
    } finally {
      setMessageSubmitting(false);
    }
  }

  // Minimum value for the datetime-local input — can't schedule into the past.
  function minScheduleValue() {
    const d = new Date(Date.now() + 60000); // at least a minute from now
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function submitSchedule() {
    setScheduleError("");
    if (!scheduleDate) {
      setScheduleError("Pick a date and time first.");
      return false;
    }
    const iso = new Date(scheduleDate).toISOString();
    setScheduleSubmitting(true);
    try {
      await api.patch("/settings/maintenance", {
        maintenanceMode: maintenance.maintenanceMode, // leave the live on/off switch untouched
        scheduledAt: iso,
      });
      await maintenance.refresh();
      setScheduleDate("");
      return true;
    } catch (err) {
      setScheduleError(err.message);
      return false;
    } finally {
      setScheduleSubmitting(false);
    }
  }

  async function cancelSchedule() {
    const ok = await confirm({
      title: "Cancel maintenance notification?",
      message: "Staff will no longer see the upcoming-maintenance heads-up.",
      confirmText: "Cancel Notification",
      tone: "danger",
    });
    if (!ok) return false;
    setScheduleError("");
    setCancelSubmitting(true);
    try {
      await api.patch("/settings/maintenance", {
        maintenanceMode: maintenance.maintenanceMode,
        scheduledAt: null,
      });
      await maintenance.refresh();
      return true;
    } catch (err) {
      setScheduleError(err.message);
      return false;
    } finally {
      setCancelSubmitting(false);
    }
  }

  // Bound to the notification Switch: toggling on sends it (using the
  // date/time already picked), toggling off cancels the pending one.
  async function toggleScheduleNotification(next) {
    if (next) {
      await submitSchedule();
    } else {
      await cancelSchedule();
    }
  }

  function scrollTo(ref, setOpen) {
    setOpen(true);
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const filteredSchools = schools.filter((s) => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.address, s.phone, s.email, s.managerName, s.managerEmail, s.managerPhone]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });

  const { pageItems: pagedSchools, page: schoolsPage, setPage: setSchoolsPage, totalPages: schoolsTotalPages, total: schoolsTotal, pageSize: schoolsPageSize } =
    usePagination(filteredSchools, 8);

  const statCards = stats
    ? [
        {
          key: "schools",
          label: "Schools",
          value: stats.totals.totalSchools,
          sub: `${stats.totals.activeSchools} active · ${stats.totals.suspendedSchools} suspended`,
          icon: SchoolIcon,
          accent: "from-blue-400 to-blue-600",
          onClick: () => scrollTo(allSchoolsRef, setOpenAllSchools),
        },
        {
          key: "managers",
          label: "Managers",
          value: stats.totals.totalManagers,
          sub: `${stats.totals.activeManagers} active`,
          icon: ShieldCheck,
          accent: "from-violet-400 to-violet-600",
          onClick: () => scrollTo(breakdownRef, setOpenBreakdown),
        },
        {
          key: "teachers",
          label: "Teachers",
          value: stats.totals.totalTeachers,
          sub: `${stats.totals.activeTeachers} active`,
          icon: Users,
          accent: "from-teal-400 to-teal-600",
          onClick: () => scrollTo(breakdownRef, setOpenBreakdown),
        },
        {
          key: "students",
          label: "Students",
          value: stats.totals.totalStudents,
          sub: `${stats.totals.activeStudents} active`,
          icon: GraduationCap,
          accent: "from-amber-400 to-amber-600",
          onClick: () => scrollTo(breakdownRef, setOpenBreakdown),
        },
        {
          key: "classes",
          label: "Classes",
          value: stats.totals.totalClasses,
          icon: Layers,
          accent: "from-rose-400 to-rose-600",
          onClick: () => scrollTo(breakdownRef, setOpenBreakdown),
        },
      ]
    : [];

  const quickLinks = [
    {
      label: "Manage Schools",
      hint: "Search, create, suspend, or reactivate schools",
      icon: SchoolIcon,
      accent: "from-blue-400 to-blue-600",
      onClick: () => scrollTo(allSchoolsRef, setOpenAllSchools),
    },
    {
      label: "Maintenance Mode",
      hint: maintenance.maintenanceMode
        ? "Currently active — schools are locked out"
        : maintenance.scheduledAt
        ? `Notice sent for ${new Date(maintenance.scheduledAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`
        : "Take the platform offline with a custom message",
      icon: Wrench,
      accent:
        maintenance.maintenanceMode || maintenance.scheduledAt
          ? "from-amber-400 to-amber-600"
          : "from-slate-400 to-slate-600",
      onClick: () => scrollTo(maintenanceRef, setOpenMaintenance),
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New School
        </Button>
      </div>

      <ErrorText>{statsError}</ErrorText>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          {statCards.map((s) => (
            <StatCard key={s.key} clickable {...s} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {quickLinks.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={link.onClick}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200 text-left"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.accent} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
            >
              <link.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{link.label}</p>
              <p className="text-sm text-slate-500">{link.hint}</p>
            </div>
            <ArrowRight size={16} className="ml-auto shrink-0 text-slate-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      <div ref={breakdownRef}>
        <AccordionSection
          icon={ListChecks}
          title="Per-School Breakdown"
          subtitle="Active teachers, students, and classes by school."
          accent="from-violet-400 to-violet-600"
          open={openBreakdown}
          onToggle={setOpenBreakdown}
        >
          {stats && (
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
          )}
        </AccordionSection>
      </div>

      <div ref={allSchoolsRef}>
        <AccordionSection
          icon={SchoolIcon}
          title="All Schools"
          subtitle="Every school registered on the platform."
          accent="from-blue-400 to-blue-600"
          open={openAllSchools}
          onToggle={setOpenAllSchools}
        >
          <div className="mb-4">
            <SearchInput
              value={schoolQuery}
              onChange={setSchoolQuery}
              placeholder="Search by school, manager, or email..."
              className="w-full sm:w-64"
            />
          </div>

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
              {pagedSchools.map((s) => (
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Password changed</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetManagerPassword(s)}
                          title="Issue a new temporary password"
                        >
                          <KeyRound size={14} /> Reset
                        </Button>
                      </div>
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

          <Pagination
            page={schoolsPage}
            totalPages={schoolsTotalPages}
            onPageChange={setSchoolsPage}
            total={schoolsTotal}
            pageSize={schoolsPageSize}
          />
        </AccordionSection>
      </div>

      <div ref={maintenanceRef}>
        <AccordionSection
          icon={Wrench}
          title="Maintenance Mode"
          subtitle="Take the platform offline for schools with a message you control."
          accent="from-amber-400 to-amber-600"
          open={openMaintenance}
          onToggle={setOpenMaintenance}
        >
          {!maintenance.checked ? (
            <p className="text-sm text-slate-400 py-2">Loading current status…</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={maintenance.maintenanceMode}
                    onChange={toggleMaintenanceMode}
                    disabled={toggleSubmitting}
                    label="Toggle maintenance mode"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {toggleSubmitting
                        ? "Updating…"
                        : maintenance.maintenanceMode
                        ? "Currently ON"
                        : "Currently OFF"}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Flips immediately — every manager and teacher sees your message instead of
                      the app the moment this switches on. Superusers always keep access.
                    </p>
                  </div>
                </div>
                <Badge tone={maintenance.maintenanceMode ? "warning" : "pass"}>
                  Currently {maintenance.maintenanceMode ? "Active" : "Inactive"}
                </Badge>
              </div>

              <ErrorText>{maintError}</ErrorText>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {maintenance.title || "No title set yet"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md line-clamp-2">
                    {maintenance.message || "No message set yet — schools will see a default message."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {maintenance.updatedByName ? `Last changed by ${maintenance.updatedByName}` : "Never changed yet"}
                    {maintenance.updatedAt &&
                      ` · ${new Date(maintenance.updatedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                  </p>
                </div>
                <Button variant="primary" onClick={openMessageModal}>
                  Set Message
                </Button>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarClock size={16} className="text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800">Maintenance Notification</p>
                </div>
                <p className="text-xs text-slate-500 mb-4 max-w-md">
                  Give schools a heads-up about an upcoming maintenance window. Toggling this on
                  only sends a notification — it does <span className="font-semibold">not</span>{" "}
                  switch maintenance mode on by itself, and it disappears on its own once the time
                  passes.
                </p>

                {!maintenance.scheduledAt && (
                  <div className="mb-4">
                    <Field label="Date & time">
                      <Input
                        type="datetime-local"
                        value={scheduleDate}
                        min={minScheduleValue()}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={!!maintenance.scheduledAt}
                      onChange={toggleScheduleNotification}
                      disabled={scheduleSubmitting || cancelSubmitting}
                      label="Toggle maintenance notification"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {scheduleSubmitting
                          ? "Sending…"
                          : cancelSubmitting
                          ? "Cancelling…"
                          : maintenance.scheduledAt
                          ? "Notification ON"
                          : "Notification OFF"}
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {maintenance.scheduledAt ? (
                          <>
                            Staff were notified of maintenance planned for{" "}
                            {new Date(maintenance.scheduledAt).toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            .
                          </>
                        ) : (
                          "Pick a date & time above, then switch this on to notify staff."
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <ErrorText>{scheduleError}</ErrorText>
              </div>
            </div>
          )}
        </AccordionSection>
      </div>

      <Modal
        open={messageModalOpen}
        onClose={closeMessageModal}
        title="Set Maintenance Message"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeMessageModal} disabled={messageSubmitting}>
              Cancel
            </Button>
            <Button onClick={saveMessage} disabled={messageSubmitting}>
              {messageSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title shown to schools">
            <Input
              value={messageDraft.title}
              onChange={(e) => updateMessageField("title", e.target.value)}
              maxLength={80}
              placeholder="We'll be right back"
            />
          </Field>

          <Field label="Message shown to schools">
            <Textarea
              rows={4}
              value={messageDraft.message}
              onChange={(e) => updateMessageField("message", e.target.value)}
              maxLength={500}
              placeholder="The system is currently undergoing scheduled maintenance. Please check back shortly."
            />
          </Field>

          <ErrorText>{messageError}</ErrorText>
        </div>
      </Modal>

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
        <form noValidate onSubmit={handleCreateSchool} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-brand-500 flex items-center justify-center">
              <SchoolIcon size={16} className="text-white" />
            </div>
            <p className="text-xs text-brand-700 leading-snug">
              This creates the school and its first Manager account, with a temporary password
              you'll be able to share with them afterward.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2.5">School Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="School Name">
                <IconInput
                  icon={SchoolIcon}
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. Green Hills Academy"
                  required
                  autoFocus
                />
              </Field>
              <Field label="School Email">
                <IconInput
                  icon={Mail}
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="info@school.com"
                />
              </Field>
              <Field label="Location / Address">
                <IconInput
                  icon={MapPin}
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="School Phone">
                <IconInput
                  icon={Phone}
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2.5">First Manager</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Manager Name" className="sm:col-span-2">
                <IconInput
                  icon={UserCircle2}
                  value={form.managerName}
                  onChange={(e) => updateField("managerName", e.target.value)}
                  placeholder="Full name"
                  required
                />
              </Field>
              <Field label="Manager Email">
                <IconInput
                  icon={Mail}
                  type="email"
                  value={form.managerEmail}
                  onChange={(e) => updateField("managerEmail", e.target.value)}
                  placeholder="manager@school.com"
                  required
                />
              </Field>
              <Field label="Manager Phone">
                <IconInput
                  icon={Phone}
                  value={form.managerPhone}
                  onChange={(e) => updateField("managerPhone", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>

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
