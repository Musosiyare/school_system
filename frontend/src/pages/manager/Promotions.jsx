import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Field, IconSelect } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import {
  CalendarDays,
  Layers,
  ArrowRight,
  ArrowUpCircle,
  Copy,
  Users,
} from "lucide-react";

const ACTIONS = [
  { value: "promoted", label: "Promote to next level", needsDestClass: true },
  { value: "repeated", label: "Repeat this level", needsDestClass: true },
  { value: "transferred", label: "Transfer (new class, new year)", needsDestClass: true },
  { value: "graduated", label: "Graduate (leaving school)", needsDestClass: false },
  { value: "dropped", label: "Drop out / left school", needsDestClass: false },
];

export default function Promotions() {
  const confirm = useConfirm();

  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);

  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [destYearId, setDestYearId] = useState("");
  const [destClassId, setDestClassId] = useState("");
  const [action, setAction] = useState("promoted");

  const [roster, setRoster] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);

  async function loadBase() {
    const [yearsRes, classesRes] = await Promise.all([
      api.get("/academic-years?all=true"),
      api.get("/classes"),
    ]);
    setYears(yearsRes.data.academicYears);
    setClasses(classesRes.data.classes);
  }

  useEffect(() => {
    loadBase();
  }, []);

  // Default destination year to whichever one is marked current — that's
  // almost always where a manager is promoting students INTO.
  useEffect(() => {
    if (!destYearId && years.length > 0) {
      const current = years.find((y) => y.isCurrent);
      if (current) setDestYearId(String(current.id));
    }
  }, [years, destYearId]);

  const sourceClasses = useMemo(
    () => classes.filter((c) => String(c.academicYearId ?? c.AcademicYear?.id) === sourceYearId),
    [classes, sourceYearId]
  );
  const destClasses = useMemo(
    () => classes.filter((c) => String(c.academicYearId ?? c.AcademicYear?.id) === destYearId),
    [classes, destYearId]
  );

  const needsDestClass = ACTIONS.find((a) => a.value === action)?.needsDestClass;
  const sourceClass = classes.find((c) => String(c.id) === sourceClassId);
  const destClass = classes.find((c) => String(c.id) === destClassId);

  async function loadRoster() {
    if (!sourceClassId) return;
    setRosterLoading(true);
    setError("");
    setResults(null);
    try {
      const params = { classId: sourceClassId };
      if (destYearId) params.destAcademicYearId = destYearId;
      const res = await api.get("/promotions/roster", { params });
      setRoster(res.data.students);
      // Pre-select everyone who hasn't already been processed for the
      // destination year, so the common case (promote the whole class) is
      // one click away.
      setSelectedIds(
        res.data.students.filter((s) => !s.alreadyProcessedForDestYear).map((s) => s.id)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceClassId, destYearId]);

  function toggleStudent(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleAll() {
    const selectable = roster.filter((s) => !s.alreadyProcessedForDestYear).map((s) => s.id);
    setSelectedIds((ids) => (ids.length === selectable.length ? [] : selectable));
  }

  async function handleClone() {
    if (!sourceClass || !destYearId) return;
    setCloning(true);
    setError("");
    try {
      const res = await api.post(`/classes/${sourceClass.id}/clone`, {
        destAcademicYearId: Number(destYearId),
        name: cloneName || undefined,
      });
      await loadBase();
      setDestClassId(String(res.data.class.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setCloning(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    setResults(null);

    if (!sourceClassId) return setError("Choose a source class first.");
    if (needsDestClass && !destClassId) {
      return setError("Choose a destination class, or clone one from the source class first.");
    }
    if (selectedIds.length === 0) return setError("Select at least one student.");

    const actionLabel = ACTIONS.find((a) => a.value === action)?.label.toLowerCase();
    const ok = await confirm({
      title: "Confirm this action",
      message: `${selectedIds.length} student(s) will be marked "${actionLabel}". This does not change or delete any past records — it only adds new ones.`,
      confirmText: "Yes, proceed",
      tone: "primary",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.post("/promotions", {
        sourceClassId: Number(sourceClassId),
        destClassId: needsDestClass ? Number(destClassId) : undefined,
        status: action,
        studentIds: selectedIds,
      });
      setResults(res.data.results);
      setSuccess(res.data.summary);
      await loadRoster();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Card
        title="1. Choose who's moving"
        subtitle="Pick the class students are currently in, and where they're going next."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From (current)</p>
            <Field label="Source academic year">
              <IconSelect
                icon={CalendarDays}
                value={sourceYearId}
                onChange={(e) => {
                  setSourceYearId(e.target.value);
                  setSourceClassId("");
                }}
              >
                <option value="">Select year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? "(current)" : ""}
                  </option>
                ))}
              </IconSelect>
            </Field>
            <Field label="Source class">
              <IconSelect
                icon={Layers}
                value={sourceClassId}
                onChange={(e) => setSourceClassId(e.target.value)}
                disabled={!sourceYearId}
              >
                <option value="">Select class</option>
                {sourceClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </IconSelect>
            </Field>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">To (destination)</p>
            <Field label="Action">
              <IconSelect icon={ArrowUpCircle} value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </IconSelect>
            </Field>
            {needsDestClass && (
              <>
                <Field label="Destination academic year">
                  <IconSelect
                    icon={CalendarDays}
                    value={destYearId}
                    onChange={(e) => {
                      setDestYearId(e.target.value);
                      setDestClassId("");
                    }}
                  >
                    <option value="">Select year</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? "(current)" : ""}
                      </option>
                    ))}
                  </IconSelect>
                </Field>
                <Field label="Destination class">
                  <IconSelect
                    icon={Layers}
                    value={destClassId}
                    onChange={(e) => setDestClassId(e.target.value)}
                    disabled={!destYearId}
                  >
                    <option value="">Select class</option>
                    {destClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </IconSelect>
                </Field>
                {destYearId && sourceClass && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    Don't see the right class in {years.find((y) => String(y.id) === destYearId)?.name}?
                    Clone <span className="font-medium text-slate-700">{sourceClass.name}</span> into that
                    year — this copies its module list across too, so students land somewhere with the
                    right subjects already set up.
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        className="form-field flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder={`New name (default: ${sourceClass.name})`}
                        value={cloneName}
                        onChange={(e) => setCloneName(e.target.value)}
                      />
                      <Button size="sm" variant="secondary" onClick={handleClone} disabled={cloning}>
                        <Copy size={14} /> {cloning ? "Cloning..." : "Clone class"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="2. Pick students"
        subtitle={
          sourceClass && destClass
            ? `Moving from ${sourceClass.name} into ${destClass.name}`
            : "Select a source class above to see its students."
        }
        actions={
          roster.length > 0 && (
            <Button size="sm" variant="secondary" onClick={toggleAll}>
              <Users size={14} /> Select / deselect all
            </Button>
          )
        }
      >
        <Table>
          <Thead>
            <tr>
              <Th className="w-10"></Th>
              <Th>Student</Th>
              <Th>Admission #</Th>
              <Th className="text-right">Status</Th>
            </tr>
          </Thead>
          <tbody>
            {rosterLoading && <EmptyRow colSpan={4}>Loading roster...</EmptyRow>}
            {!rosterLoading && !sourceClassId && (
              <EmptyRow colSpan={4}>Choose a source class to load its students.</EmptyRow>
            )}
            {!rosterLoading && sourceClassId && roster.length === 0 && (
              <EmptyRow colSpan={4}>No active students in this class.</EmptyRow>
            )}
            {!rosterLoading &&
              roster.map((s) => {
                const result = results?.find((r) => r.studentId === s.id);
                return (
                  <tr key={s.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        disabled={s.alreadyProcessedForDestYear}
                        onChange={() => toggleStudent(s.id)}
                        className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                      />
                    </Td>
                    <Td className="font-medium text-slate-800">
                      {s.firstName} {s.lastName}
                    </Td>
                    <Td className="text-slate-500">{s.admissionNumber}</Td>
                    <Td className="text-right">
                      {result ? (
                        <Badge tone={result.success ? "pass" : "fail"}>
                          {result.success ? "Done" : result.message}
                        </Badge>
                      ) : s.alreadyProcessedForDestYear ? (
                        <Badge tone="neutral">Already processed</Badge>
                      ) : (
                        <Badge tone="warning">Pending</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {selectedIds.length} student(s) selected. Last year's class, marks and history are never
            changed by this — only new records are added.
          </p>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing..." : "Run this action"} <ArrowRight size={15} />
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
        <SuccessText>{success}</SuccessText>
      </Card>
    </div>
  );
}
