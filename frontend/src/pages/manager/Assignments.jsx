import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Select } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import {
  Trash2,
  Plus,
  ClipboardList,
  Repeat,
  Search,
  ChevronDown,
  UserRound,
  Layers,
} from "lucide-react";

export default function Assignments() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // --- New assignment modal state ---
  const [creating, setCreating] = useState(false);
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [checkedModuleIds, setCheckedModuleIds] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Reassign modal state ---
  const [reassigning, setReassigning] = useState(null); // assignment being reassigned, or null
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [reassignError, setReassignError] = useState("");
  const [reassignSaving, setReassignSaving] = useState(false);

  // --- Grouped-view controls ---
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all"); // "all" or a class id
  const [collapsed, setCollapsed] = useState({}); // teacherId -> bool (true = expanded)

  async function loadAll() {
    const [teachersRes, classesRes, assignmentsRes] = await Promise.all([
      api.get("/teachers"),
      api.get("/classes"),
      api.get("/assignments"),
    ]);
    setTeachers(teachersRes.data.teachers);
    setClasses(classesRes.data.classes);
    setAssignments(assignmentsRes.data.assignments);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Only teachers who currently work at the school can be assigned to teach
  // something new. Deactivated teachers stay in `teachers` (so their name
  // still shows on existing/historical assignments) but must never appear
  // as a pickable option going forward.
  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === "active"), [teachers]);

  // Modules that belong to the selected class only.
  const modulesInClass = useMemo(() => {
    const klass = classes.find((c) => String(c.id) === String(classId));
    if (!klass) return [];
    return (klass.ClassModules || []).map((cm) => cm.Module).filter(Boolean);
  }, [classes, classId]);

  // Modules (within this class) already taught by the selected teacher — used
  // to pre-check the boxes when both a class and teacher are picked.
  const existingModuleIdsForTeacher = useMemo(() => {
    if (!classId || !teacherId) return [];
    return assignments
      .filter((a) => String(a.classId) === String(classId) && String(a.teacherId) === String(teacherId))
      .map((a) => a.moduleId);
  }, [assignments, classId, teacherId]);

  function openCreate() {
    setClassId("");
    setTeacherId("");
    setCheckedModuleIds([]);
    setError("");
    setCreating(true);
  }

  function handleClassChange(value) {
    setClassId(value);
    setTeacherId("");
    setCheckedModuleIds([]); // module list changes with class, so clear selection
  }

  function handleTeacherChange(value) {
    setTeacherId(value);
    // Pre-check whatever this teacher already teaches in this class
    const preChecked = assignments
      .filter((a) => String(a.classId) === String(classId) && String(a.teacherId) === String(value))
      .map((a) => a.moduleId);
    setCheckedModuleIds(preChecked);
  }

  function toggleModule(moduleId) {
    setCheckedModuleIds((ids) =>
      ids.includes(moduleId) ? ids.filter((id) => id !== moduleId) : [...ids, moduleId]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const toAdd = checkedModuleIds.filter((id) => !existingModuleIdsForTeacher.includes(id));
      const toRemove = assignments.filter(
        (a) =>
          String(a.classId) === String(classId) &&
          String(a.teacherId) === String(teacherId) &&
          !checkedModuleIds.includes(a.moduleId)
      );

      await Promise.all([
        ...toAdd.map((moduleId) =>
          api.post("/assignments", {
            teacherId: Number(teacherId),
            moduleId: Number(moduleId),
            classId: Number(classId),
          })
        ),
        ...toRemove.map((a) => api.delete(`/assignments/${a.id}`)),
      ]);

      setCreating(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(a) {
    const ok = await confirm({
      title: "Remove this assignment?",
      message: `${a.teacher?.name} will no longer be able to record marks for ${a.Module?.moduleTitle} in ${a.Class?.name}.`,
      confirmText: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/assignments/${a.id}`);
      await loadAll();
    } catch (err) {
      notify({ title: "Couldn't remove assignment", message: err.message, tone: "error" });
    }
  }

  function openReassign(a) {
    setReassigning(a);
    setReassignTeacherId("");
    setReassignError("");
  }

  async function handleReassign(e) {
    e.preventDefault();
    setReassignError("");
    setReassignSaving(true);
    try {
      await api.patch(`/assignments/${reassigning.id}`, {
        teacherId: Number(reassignTeacherId),
      });
      setReassigning(null);
      await loadAll();
    } catch (err) {
      setReassignError(err.message);
    } finally {
      setReassignSaving(false);
    }
  }

  const selectedClassName = classes.find((c) => String(c.id) === String(classId))?.name;

  // --- Group assignments by teacher, so a school with lots of records reads
  // as "who teaches what" instead of one long flat table. ---
  const groups = useMemo(() => {
    const byTeacher = new Map();
    for (const a of assignments) {
      if (classFilter !== "all" && String(a.classId) !== String(classFilter)) continue;
      const key = a.teacherId;
      if (!byTeacher.has(key)) {
        byTeacher.set(key, {
          teacherId: key,
          teacherName: a.teacher?.name || "Unknown teacher",
          teacherStatus: teachers.find((t) => t.id === key)?.status,
          rows: [],
        });
      }
      byTeacher.get(key).rows.push(a);
    }
    let list = Array.from(byTeacher.values());

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => g.teacherName.toLowerCase().includes(q));
    }

    list.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
    for (const g of list) {
      g.rows.sort((a, b) => (a.Class?.name || "").localeCompare(b.Class?.name || ""));
    }
    return list;
  }, [assignments, teachers, search, classFilter]);

  function toggleCollapsed(teacherId) {
    setCollapsed((c) => ({ ...c, [teacherId]: !c[teacherId] }));
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Assignment
        </Button>
      </div>

      <Card
        title="Current Assignments"
        subtitle="Grouped by teacher — search a name or filter by class to narrow things down."
      >
        {/* Controls: search by teacher, toggle by class taught */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teacher name..."
              className="form-field w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800
                placeholder:text-slate-400 outline-none transition focus:border-black focus:ring-0 shadow-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <Layers size={13} /> Class
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setClassFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  classFilter === "all"
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All classes
              </button>
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClassFilter(String(c.id))}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    classFilter === String(c.id)
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
            <ClipboardList size={22} className="text-slate-300" />
            {assignments.length === 0
              ? 'No assignments yet. Click "New Assignment" to create one.'
              : "No teachers match your search / filter."}
          </div>
        )}

        <div className="space-y-3">
          {groups.map((g) => {
            const isExpanded = !!collapsed[g.teacherId];
            return (
              <div key={g.teacherId} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(g.teacherId)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center ring-1 ring-brand-100">
                      <UserRound size={16} />
                    </div>
                    <span className="font-medium text-slate-800 truncate">{g.teacherName}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {g.rows.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap"
                      >
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium text-slate-700">{a.Module?.moduleTitle}</span>
                          <span className="text-slate-300">·</span>
                          <Badge tone="manager">{a.Class?.name}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openReassign(a)}>
                            <Repeat size={14} /> Reassign
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRemove(a)}>
                            <Trash2 size={14} /> Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* New / edit assignment modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Assignment"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !classId || !teacherId}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Class">
              <Select value={classId} onChange={(e) => handleClassChange(e.target.value)} required>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Teacher">
              <Select
                value={teacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                required
                disabled={!classId}
              >
                <option value="">Select teacher</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Modules {selectedClassName ? `in ${selectedClassName}` : "in this class"}
            </p>
            {!classId ? (
              <p className="text-sm text-slate-400">Select a class first to see its modules.</p>
            ) : modulesInClass.length === 0 ? (
              <p className="text-sm text-slate-400">
                This class has no modules yet — add one from the Classes page first.
              </p>
            ) : !teacherId ? (
              <p className="text-sm text-slate-400">Select a teacher to check off what they teach.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {modulesInClass.map((m) => {
                  const takenByOther = assignments.find(
                    (a) =>
                      String(a.classId) === String(classId) &&
                      a.moduleId === m.id &&
                      String(a.teacherId) !== String(teacherId)
                  );
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-sm text-slate-700 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checkedModuleIds.includes(m.id)}
                        onChange={() => toggleModule(m.id)}
                        className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                      />
                      {m.moduleTitle}
                      {takenByOther && (
                        <span className="text-xs text-amber-600">
                          (currently {takenByOther.teacher?.name})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Checking a module assigns it to this teacher; unchecking one that was already assigned
              to them removes that assignment. Checking a module already taught by someone else here
              reassigns it to this teacher instead.
            </p>
          </div>

          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={!!reassigning}
        onClose={() => setReassigning(null)}
        title="Reassign"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassigning(null)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={reassignSaving || !reassignTeacherId}>
              {reassignSaving ? "Reassigning..." : "Reassign"}
            </Button>
          </>
        }
      >
        {reassigning && (
          <form noValidate onSubmit={handleReassign} className="space-y-4">
            <p className="text-sm text-slate-600">
              Move <span className="font-medium text-slate-800">{reassigning.Module?.moduleTitle}</span> in{" "}
              <span className="font-medium text-slate-800">{reassigning.Class?.name}</span> from{" "}
              <span className="font-medium text-slate-800">{reassigning.teacher?.name}</span> to:
            </p>
            <Field label="New Teacher">
              <Select value={reassignTeacherId} onChange={(e) => setReassignTeacherId(e.target.value)} required>
                <option value="">Select teacher</option>
                {activeTeachers
                  .filter((t) => t.id !== reassigning.teacherId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <ErrorText>{reassignError}</ErrorText>
          </form>
        )}
      </Modal>
    </div>
  );
}
