import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, IconInput } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import { useYear } from "../../context/YearContext";
import { Lock, Unlock, Plus, CalendarRange, CheckCircle2, ChevronDown, ChevronUp, Trash2, Pencil, Loader2 } from "lucide-react";

function statusStyles(isLocked) {
  return isLocked
    ? {
        card: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
        iconWrap: "bg-rose-100 text-rose-600",
        text: "text-rose-600",
        track: "bg-rose-400",
      }
    : {
        card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
        iconWrap: "bg-emerald-100 text-emerald-600",
        text: "text-emerald-600",
        track: "bg-emerald-400",
      };
}

// Pill-shaped animated switch — thumb slides right/green when a term is
// open (marks editable), left/rose when it's locked. Replaces the old
// plain "Lock"/"Unlock" text button with something that reads at a glance.
function LockSwitch({ isLocked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={!isLocked}
      title={isLocked ? "Unlock this term" : "Lock this term"}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-brand-100 ${
        isLocked ? "bg-rose-300" : "bg-emerald-400"
      }`}
    >
      <span
        className={`inline-flex h-[18px] w-[18px] transform items-center justify-center rounded-full bg-white shadow transition-transform duration-300 ${
          isLocked ? "translate-x-1" : "translate-x-[22px]"
        }`}
      >
        {isLocked ? <Lock size={10} className="text-rose-500" /> : <Unlock size={10} className="text-emerald-500" />}
      </span>
    </button>
  );
}

// One term's status card: colored icon badge, name, a plain-language
// status line, and the toggle switch — replaces the old table row.
function TermStatusCard({ term, onToggleLock }) {
  const s = statusStyles(term.isLocked);
  return (
    <div className={`relative rounded-xl border p-4 transition-colors duration-300 ${s.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${s.iconWrap}`}>
            {term.isLocked ? <Lock size={17} /> : <Unlock size={17} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{term.name}</p>
            <p className={`text-xs font-medium ${s.text}`}>
              {term.isLocked ? "Locked — marks can't be edited" : "Open — marks can be edited"}
            </p>
          </div>
        </div>
        <LockSwitch isLocked={term.isLocked} onClick={() => onToggleLock(term)} />
      </div>
    </div>
  );
}

// Renders one academic year's card: name/badge, an optional "Make Active"
// action, and its terms as a grid of status cards with lock/unlock
// switches. Edit and Delete are icon-only buttons (Edit neutral, Delete
// orange) rather than labeled buttons, so the row of actions stays compact.
function YearCard({ year, onSetCurrent, settingCurrentId, onToggleLock, onEdit, onDelete, deletingId }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {year.name}
          {year.isCurrent && <Badge tone="pass">Active Year</Badge>}
        </span>
      }
      actions={
        <>
          {!year.isCurrent && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSetCurrent(year)}
              disabled={settingCurrentId === year.id}
            >
              <CheckCircle2 size={14} />
              {settingCurrentId === year.id ? "Setting..." : "Make Active"}
            </Button>
          )}
          <button
            type="button"
            onClick={() => onEdit(year)}
            title="Edit academic year"
            aria-label="Edit academic year"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Pencil size={16} />
          </button>
          {!year.isCurrent && (
            <button
              type="button"
              onClick={() => onDelete(year)}
              disabled={deletingId === year.id}
              title="Delete academic year"
              aria-label="Delete academic year"
              className="inline-flex items-center justify-center rounded-lg p-2 text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingId === year.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(year.Terms || []).map((t) => (
          <TermStatusCard key={t.id} term={t} onToggleLock={onToggleLock} />
        ))}
      </div>
    </Card>
  );
}

export default function AcademicYears() {
  const confirm = useConfirm();
  const notify = useNotify();
  const { setViewingYearId, refreshYears } = useYear();
  const [years, setYears] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingYear, setEditingYear] = useState(null); // year object being renamed, or null
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  // Other (non-current) years stay hidden until the manager explicitly asks
  // to see them, e.g. to switch which year is current.
  const [showOthers, setShowOthers] = useState(false);

  async function load() {
    // ?all=true pulls the full history for this management page. Everywhere
    // else in the app (class creation, marks entry, reports) calls this same
    // endpoint without that flag and gets back only the current year.
    const { data } = await api.get("/academic-years", { params: { all: true } });
    setYears(data.academicYears);
  }

  useEffect(() => {
    load();
  }, []);

  const currentYear = years.find((y) => y.isCurrent) || null;
  const otherYears = years.filter((y) => !y.isCurrent);

  // If nothing is marked current yet (fresh school, or legacy data from
  // before this feature), there's nothing useful to show collapsed — open
  // the list automatically so the manager can pick one.
  useEffect(() => {
    if (years.length > 0 && !currentYear) setShowOthers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  function openCreate() {
    setName("");
    setError("");
    setCreating(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/academic-years", { name });
      setCreating(false);
      await load();
      await refreshYears();
      if (data.carriedClasses > 0) {
        notify({
          title: "Classes carried forward",
          message: `${data.carriedClasses} class${data.carriedClasses === 1 ? "" : "es"} from your outgoing year (same names, categories, teachers, and modules) ${data.carriedClasses === 1 ? "was" : "were"} copied into ${name}. Rosters and marks always start empty.`,
          tone: "info",
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function setCurrent(year) {
    const ok = await confirm({
      title: `Make ${year.name} the active year?`,
      message:
        "New classes, marks entry, and reports will go into this year from now on. Every other year (including the one you're leaving) becomes read-only archive data — still viewable any time using the year switcher in the header, just no longer editable.",
      confirmText: "Make Active",
      tone: "primary",
    });
    if (!ok) return;
    setSettingCurrentId(year.id);
    try {
      await api.patch(`/academic-years/${year.id}/set-current`);
      await load();
      // Jump the header's "viewing year" to match — otherwise the manager
      // stays looking at whatever year they were on, which is now archived,
      // without any obvious reason why things suddenly look read-only.
      await refreshYears();
      setViewingYearId(year.id);
      // Collapse the "other years" list back down now that the switch is
      // done — otherwise it stays open showing the year you just left,
      // which reads as if nothing happened until you refresh.
      setShowOthers(false);
    } finally {
      setSettingCurrentId(null);
    }
  }

  function openEdit(year) {
    setEditingYear(year);
    setEditName(year.name);
    setEditError("");
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingYear) return;
    setEditError("");
    setEditSubmitting(true);
    try {
      await api.patch(`/academic-years/${editingYear.id}`, { name: editName });
      setEditingYear(null);
      await load();
      await refreshYears();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function toggleLock(term) {
    const locking = !term.isLocked;
    const ok = await confirm({
      title: locking ? `Lock ${term.name}?` : `Unlock ${term.name}?`,
      message: locking
        ? "Subject teachers will no longer be able to submit or edit marks for this term, or view/download its report cards. You (as head teacher) can still view and download them."
        : "Subject teachers will be able to submit/edit marks and view/download report cards for this term again.",
      confirmText: locking ? "Lock Term" : "Unlock Term",
      tone: locking ? "danger" : "primary",
    });
    if (!ok) return;
    await api.patch(`/terms/${term.id}/lock`, { isLocked: locking });
    await load();
  }

  async function handleDelete(year) {
    const ok = await confirm({
      title: `Delete ${year.name}?`,
      message:
        "This can't be undone. Only allowed if this year has no students enrolled and no marks recorded in any of its classes — otherwise it will be blocked to protect that data.",
      confirmText: "Delete Year",
      tone: "danger",
    });
    if (!ok) return;

    setDeletingId(year.id);
    try {
      await api.delete(`/academic-years/${year.id}`);
      await load();
      await refreshYears();
    } catch (err) {
      const blocked = err.code === "YEAR_NOT_EMPTY" || err.code === "CANNOT_DELETE_CURRENT_YEAR";
      notify({
        title: blocked ? "Can't delete this year" : "Delete failed",
        message: err.message,
        tone: blocked ? "warning" : "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Academic Year
        </Button>
      </div>

      {years.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-slate-400 text-sm">
            <CalendarRange size={22} className="text-slate-300" />
            No academic years yet. Click "New Academic Year" to create one.
          </div>
        </Card>
      )}

      {currentYear && (
        <YearCard
          year={currentYear}
          onSetCurrent={setCurrent}
          settingCurrentId={settingCurrentId}
          onToggleLock={toggleLock}
          onEdit={openEdit}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      {otherYears.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 mb-4"
          >
            {showOthers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showOthers
              ? "Hide other academic years"
              : `Show other academic years (${otherYears.length})`}
          </button>

          {showOthers &&
            otherYears.map((y) => (
              <YearCard
                key={y.id}
                year={y}
                onSetCurrent={setCurrent}
                settingCurrentId={settingCurrentId}
                onToggleLock={toggleLock}
                onEdit={openEdit}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
        </>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Academic Year"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-brand-500 flex items-center justify-center">
              <CalendarRange size={16} className="text-white" />
            </div>
            <p className="text-xs text-brand-700 leading-snug">
              Creating an academic year automatically creates Term 1, Term 2, and Term 3 — and carries
              forward your current classes (names, categories, teachers, and modules) so you don't have to
              rebuild them. Rosters and marks always start empty for the new year.
            </p>
          </div>
          <Field label="Name">
            <IconInput
              icon={CalendarRange}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026-2027"
              required
              autoFocus
            />
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={!!editingYear}
        onClose={() => setEditingYear(null)}
        title="Edit Academic Year"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingYear(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleEditSubmit} className="space-y-4">
          <Field label="Name">
            <IconInput
              icon={CalendarRange}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. 2026-2027"
              required
              autoFocus
            />
          </Field>
          <ErrorText>{editError}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
