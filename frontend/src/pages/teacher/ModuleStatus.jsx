import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { Power, PowerOff, Lock, Loader2, SlidersHorizontal, GraduationCap } from "lucide-react";

// One clickable cell in the matrix: shows this module's current state for
// this one term, and toggles it on click. Kept as its own component so each
// cell can carry its own "saving" spinner without re-rendering the whole
// table.
function TermToggle({ disabled, locked, saving, onClick }) {
  if (locked) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
        title="This term is locked by the school manager — status can't be changed."
      >
        <Lock size={12} /> Locked
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 disabled:cursor-wait ${
        disabled
          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      }`}
    >
      {saving ? (
        <Loader2 size={12} className="animate-spin" />
      ) : disabled ? (
        <PowerOff size={12} />
      ) : (
        <Power size={12} />
      )}
      {saving ? "Saving..." : disabled ? "Disabled" : "Active"}
    </button>
  );
}

export default function ModuleStatus() {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [assignments, setAssignments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [yearName, setYearName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // key: `${classId}:${termId}:${moduleId}` -> { disabled, disabledAt }
  const [statusByKey, setStatusByKey] = useState({});
  // key currently being saved, so only that one cell shows a spinner
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [assignmentsRes, yearsRes] = await Promise.all([
          api.get(`/teachers/${user.id}/assignments`),
          api.get("/academic-years"),
        ]);
        const myAssignments = assignmentsRes.data.assignments || [];
        const currentYear = yearsRes.data.academicYears?.[0] || null;
        const yearTerms = currentYear?.Terms || [];
        setAssignments(myAssignments);
        setTerms(yearTerms);
        setYearName(currentYear?.name || "");

        // Fetch each unique class's module status once per term, rather
        // than once per assignment — several assignments often share the
        // same class.
        const uniqueClassIds = [...new Set(myAssignments.map((a) => a.classId))];
        const entries = await Promise.all(
          uniqueClassIds.flatMap((classId) =>
            yearTerms.map((term) =>
              api
                .get(`/classes/${classId}/term/${term.id}/module-status`)
                .then((res) => ({ classId, termId: term.id, modules: res.data.modules }))
            )
          )
        );
        const map = {};
        entries.forEach(({ classId, termId, modules }) => {
          modules.forEach((m) => {
            map[`${classId}:${termId}:${m.moduleId}`] = { disabled: m.disabled, disabledAt: m.disabledAt };
          });
        });
        setStatusByKey(map);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  async function toggle(assignment, term) {
    const key = `${assignment.classId}:${term.id}:${assignment.moduleId}`;
    const current = !!statusByKey[key]?.disabled;
    const next = !current;

    const ok = await confirm({
      title: next ? "Disable this module for this term?" : "Re-enable this module for this term?",
      message: next
        ? `${assignment.Module?.moduleTitle} will be hidden from ${assignment.Class?.name}'s ${term.name} reports and won't count toward students' weighted average. Only this term is affected — other terms and other classes stay exactly as they are.`
        : `${assignment.Module?.moduleTitle} will show again on ${assignment.Class?.name}'s ${term.name} reports and count toward the weighted average again.`,
      confirmText: next ? "Disable" : "Re-enable",
    });
    if (!ok) return;

    setSavingKey(key);
    setError("");
    try {
      await api.patch(
        `/classes/${assignment.classId}/modules/${assignment.moduleId}/term/${term.id}/status`,
        { disabled: next }
      );
      setStatusByKey((prev) => ({ ...prev, [key]: { disabled: next, disabledAt: next ? new Date().toISOString() : null } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div>
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <SlidersHorizontal size={18} />
          </div>
          <div className="min-w-0 flex flex-wrap items-center gap-2">
            <Badge tone="pass">
              <Power size={11} /> Active — counts toward marks
            </Badge>
            <Badge tone="warning">
              <PowerOff size={11} /> Disabled — excluded this term
            </Badge>
            {yearName && <Badge tone="neutral">Current year: {yearName}</Badge>}
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <Card title="Your Modules" subtitle="Tap a term to switch that module on or off for it.">
        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading your modules…</p>
        ) : terms.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <p className="text-sm text-slate-500">
              No current academic year has been set by the school manager yet, so there are no
              terms to show.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Module</Th>
                  {terms.map((t) => (
                    <Th key={t.id} className="text-center">
                      {t.name}
                      {t.isLocked && <Lock size={11} className="inline ml-1 text-slate-400" />}
                    </Th>
                  ))}
                </tr>
              </Thead>
              <tbody>
                {assignments.length === 0 && <EmptyRow colSpan={1 + terms.length}>You have no module assignments yet.</EmptyRow>}
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <GraduationCap size={14} className="text-slate-300 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">{a.Module?.moduleTitle}</div>
                          <div className="text-xs text-slate-400 truncate">{a.Class?.name}</div>
                        </div>
                      </div>
                    </Td>
                    {terms.map((t) => {
                      const key = `${a.classId}:${t.id}:${a.moduleId}`;
                      return (
                        <Td key={t.id} className="text-center">
                          <TermToggle
                            disabled={!!statusByKey[key]?.disabled}
                            locked={t.isLocked}
                            saving={savingKey === key}
                            onClick={() => toggle(a, t)}
                          />
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
