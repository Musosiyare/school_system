import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td } from "../../components/ui/Table";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { Lock, Unlock, Plus, CalendarRange, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

// Renders one academic year's card: name/badge, an optional "Set as Current"
// action, and its terms table with lock/unlock controls.
function YearCard({ year, onSetCurrent, settingCurrentId, onToggleLock }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {year.name}
          {year.isCurrent && <Badge tone="pass">Current</Badge>}
        </span>
      }
      actions={
        !year.isCurrent && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSetCurrent(year)}
            disabled={settingCurrentId === year.id}
          >
            <CheckCircle2 size={14} />
            {settingCurrentId === year.id ? "Setting..." : "Set as Current"}
          </Button>
        )
      }
    >
      <Table>
        <Thead>
          <tr>
            <Th>Term</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </Thead>
        <tbody>
          {(year.Terms || []).map((t) => (
            <tr key={t.id}>
              <Td className="font-medium text-slate-800">{t.name}</Td>
              <Td>
                <Badge tone={t.isLocked ? "fail" : "pass"}>{t.isLocked ? "Locked" : "Open"}</Badge>
              </Td>
              <Td>
                <div className="flex justify-end">
                  <Button size="sm" variant={t.isLocked ? "primary" : "danger"} onClick={() => onToggleLock(t)}>
                    {t.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                    {t.isLocked ? "Unlock" : "Lock"}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

export default function AcademicYears() {
  const confirm = useConfirm();
  const [years, setYears] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState(null);
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
      await api.post("/academic-years", { name });
      setCreating(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function setCurrent(year) {
    const ok = await confirm({
      title: `Make ${year.name} the current academic year?`,
      message:
        "Class creation, marks entry, and reports will switch to showing only this year for both managers and teachers.",
      confirmText: "Set as Current",
      tone: "primary",
    });
    if (!ok) return;
    setSettingCurrentId(year.id);
    try {
      await api.patch(`/academic-years/${year.id}/set-current`);
      await load();
    } finally {
      setSettingCurrentId(null);
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
          <Field label="Name (e.g. 2026-2027)">
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <ErrorText>{error}</ErrorText>
          <p className="text-xs text-slate-400">
            Creating an academic year automatically creates Term 1, Term 2, and Term 3.
          </p>
        </form>
      </Modal>
    </div>
  );
}
