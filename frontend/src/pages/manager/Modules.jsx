import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { Field, Input, IconInput, IconSelect } from "../../components/ui/FormField";
import { ErrorText } from "../../components/ui/Alerts";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import { Pencil, Trash2, Plus, BookOpen, Layers, ChevronDown, School2, Hash, Gauge, ListFilter } from "lucide-react";

const emptyForm = { moduleCode: "", moduleTitle: "", moduleWeight: 100, moduleType: "general" };

const MODULE_TYPE_OPTIONS = [
  { value: "specific", label: "Specific (70% to pass)" },
  { value: "general", label: "General (50% to pass)" },
  { value: "complementary", label: "Complementary (50% to pass)" },
];

const MODULE_TYPE_BADGE = {
  specific: "bg-amber-50 text-amber-700 ring-amber-100",
  general: "bg-sky-50 text-sky-700 ring-sky-100",
  complementary: "bg-violet-50 text-violet-700 ring-violet-100",
};

function moduleTypeLabel(type) {
  return MODULE_TYPE_OPTIONS.find((o) => o.value === type)?.label.split(" (")[0] || "General";
}

// Mirrors the backend's computePassingLine — used only to preview the
// passing line in the form before saving; the server always recomputes and
// owns the real value.
function previewPassingLine(moduleType, moduleWeight) {
  const pct = moduleType === "specific" ? 0.7 : 0.5;
  const weight = Number(moduleWeight) || 0;
  return +(weight * pct).toFixed(2);
}

function ModuleGroupPanel({ group, isExpanded, onToggle, openEdit, handleDelete }) {
  const { pageItems, page, setPage, totalPages, total, pageSize } = usePagination(group.modules, 8);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center ring-1 ring-brand-100">
            <School2 size={16} />
          </div>
          <span className="font-medium text-slate-800 truncate">{group.name}</span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div>
          <div className="divide-y divide-slate-100">
            {group.modules.length === 0 && (
              <div className="px-4 py-4 text-sm text-slate-400">No modules here yet.</div>
            )}
            {pageItems.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap text-sm min-w-0">
                  <span className="font-mono text-xs text-slate-500">{m.moduleCode}</span>
                  <span className="font-medium text-slate-700">{m.moduleTitle}</span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
                      MODULE_TYPE_BADGE[m.moduleType] || MODULE_TYPE_BADGE.general
                    }`}
                  >
                    {moduleTypeLabel(m.moduleType)}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums text-slate-500 text-xs">Weight {m.moduleWeight}</span>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums text-slate-500 text-xs">Pass {m.passingLine}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(m)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(m)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {group.modules.length > 0 && (
            <div className="px-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} pageSize={pageSize} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Modules() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [modules, setModules] = useState([]);
  const [classes, setClasses] = useState([]);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null); // module being edited, or null
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSelectedClassIds, setEditSelectedClassIds] = useState([]);
  const [editError, setEditError] = useState("");

  // Toggle to narrow the module list down to only those taught in a given
  // class — handy once a school has a lot of modules on the books.
  const [classFilter, setClassFilter] = useState("all"); // "all" or a class id

  // Which class groups are expanded (by class id, or "unassigned")
  const [expandedGroups, setExpandedGroups] = useState({});

  async function load() {
    const [modulesRes, classesRes] = await Promise.all([api.get("/modules"), api.get("/classes")]);
    setModules(modulesRes.data.modules);
    setClasses(classesRes.data.classes);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleClass(classId) {
    setSelectedClassIds((ids) =>
      ids.includes(classId) ? ids.filter((id) => id !== classId) : [...ids, classId]
    );
  }

  function editToggleClass(classId) {
    setEditSelectedClassIds((ids) =>
      ids.includes(classId) ? ids.filter((id) => id !== classId) : [...ids, classId]
    );
  }

  function openCreate() {
    setForm(emptyForm);
    setSelectedClassIds([]);
    setError("");
    setCreating(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/modules", {
        moduleCode: form.moduleCode,
        moduleTitle: form.moduleTitle,
        moduleWeight: Number(form.moduleWeight),
        moduleType: form.moduleType,
        classIds: selectedClassIds,
      });

      setCreating(false);
      setForm(emptyForm);
      setSelectedClassIds([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(m) {
    setEditing(m);
    setEditForm({
      moduleCode: m.moduleCode,
      moduleTitle: m.moduleTitle,
      moduleWeight: m.moduleWeight,
      moduleType: m.moduleType || "general",
    });
    setEditSelectedClassIds((m.ClassModules || []).map((cm) => cm.classId));
    setEditError("");
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditError("");
    try {
      await api.patch(`/modules/${editing.id}`, {
        moduleCode: editForm.moduleCode,
        moduleTitle: editForm.moduleTitle,
        moduleWeight: Number(editForm.moduleWeight),
        moduleType: editForm.moduleType,
      });

      // Reconcile class membership. There's no bulk "set classes for this
      // module" endpoint — only "set modules for this class" — so for every
      // class whose checked state actually changed, send that class's full
      // updated module list. This reuses the same endpoint the Classes page
      // uses, so the existing "can't remove a module with marks already
      // recorded" protection applies here too.
      const originalClassIds = (editing.ClassModules || []).map((cm) => cm.classId);
      const toAdd = editSelectedClassIds.filter((id) => !originalClassIds.includes(id));
      const toRemove = originalClassIds.filter((id) => !editSelectedClassIds.includes(id));
      const changedClassIds = [...toAdd, ...toRemove];

      if (changedClassIds.length > 0) {
        await Promise.all(
          changedClassIds.map((classId) => {
            const klass = classes.find((c) => c.id === classId);
            const currentModuleIds = (klass?.ClassModules || []).map((cm) => cm.moduleId);
            const nextModuleIds = toAdd.includes(classId)
              ? [...currentModuleIds, editing.id]
              : currentModuleIds.filter((id) => id !== editing.id);
            return api.put(`/classes/${classId}/modules`, { moduleIds: nextModuleIds });
          })
        );
      }

      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDelete(m) {
    const ok = await confirm({
      title: `Delete ${m.moduleTitle}?`,
      message:
        "This can't be undone. If marks have already been recorded for this module, deletion will be blocked to protect that data.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/modules/${m.id}`);
      await load();
    } catch (err) {
      const blockedByMarks = err.code === "MODULE_HAS_MARKS";
      notify({
        title: blockedByMarks ? "Can't delete this module" : "Delete failed",
        message: err.message,
        tone: blockedByMarks ? "warning" : "error",
      });
    }
  }

  const filteredModules =
    classFilter === "all"
      ? modules
      : modules.filter((m) => (m.ClassModules || []).some((cm) => String(cm.classId) === String(classFilter)));

  // Group the (filtered) modules by class, so the list reads as "class ->
  // modules taught there" instead of one long flat table. A module can
  // appear in more than one class group; modules with no class show up
  // under "Unassigned".
  const classGroups = (() => {
    const groups = classes
      .filter((c) => classFilter === "all" || String(c.id) === String(classFilter))
      .map((c) => ({
        key: String(c.id),
        name: c.name,
        modules: filteredModules.filter((m) => (m.ClassModules || []).some((cm) => cm.classId === c.id)),
      }));

    if (classFilter === "all") {
      const unassigned = filteredModules.filter((m) => (m.ClassModules || []).length === 0);
      if (unassigned.length > 0) {
        groups.push({ key: "unassigned", name: "Unassigned", modules: unassigned });
      }
    }

    return groups;
  })();

  function toggleGroup(key) {
    setExpandedGroups((g) => ({ ...g, [key]: !g[key] }));
  }

  const moduleFormFields = (values, onChange) => (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Module Code">
        <IconInput
          icon={Hash}
          value={values.moduleCode}
          onChange={(e) => onChange("moduleCode", e.target.value)}
          placeholder="e.g. MATH101"
          required
        />
      </Field>
      <Field label="Module Title">
        <IconInput
          icon={BookOpen}
          value={values.moduleTitle}
          onChange={(e) => onChange("moduleTitle", e.target.value)}
          placeholder="e.g. Mathematics"
          required
        />
      </Field>
      <Field label="Module Weight">
        <IconInput
          icon={Gauge}
          type="number"
          min="1"
          step="1"
          value={values.moduleWeight}
          onChange={(e) => onChange("moduleWeight", e.target.value)}
          placeholder="e.g. 20 (also the max score)"
          required
        />
      </Field>
      <Field label="Module Type">
        <IconSelect
          icon={ListFilter}
          value={values.moduleType}
          onChange={(e) => onChange("moduleType", e.target.value)}
          required
        >
          {MODULE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </IconSelect>
      </Field>
      <Field label="Passing Line (auto)" className="col-span-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 tabular-nums">
          <Gauge size={16} className="text-slate-400" />
          {previewPassingLine(values.moduleType, values.moduleWeight)} / {values.moduleWeight || 0}
        </div>
      </Field>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Module
        </Button>
      </div>

      <Card title="Existing Modules" subtitle="Weight controls how much a module counts toward the overall weighted average.">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <Layers size={13} /> Toggle by class taught
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

        {classGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
            <BookOpen size={22} className="text-slate-300" />
            {classes.length === 0
              ? "No classes yet — create one on the Classes page first."
              : "No modules match the current filter."}
          </div>
        )}

        <div className="space-y-3 mt-3">
          {classGroups.map((group) => (
            <ModuleGroupPanel
              key={group.key}
              group={group}
              isExpanded={!!expandedGroups[group.key]}
              onToggle={() => toggleGroup(group.key)}
              openEdit={openEdit}
              handleDelete={handleDelete}
            />
          ))}
        </div>
      </Card>

      {/* Create modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Module"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Module"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreate} className="space-y-5">
          {moduleFormFields(form, updateField)}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Add to classes</p>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400">No classes yet — create one on the Classes page first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {classes.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-slate-700 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.moduleTitle || ""}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </>
        }
      >
        <form noValidate onSubmit={handleSaveEdit} className="space-y-5">
          {moduleFormFields(editForm, (field, value) => setEditForm((f) => ({ ...f, [field]: value })))}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Classes</p>
            <p className="text-xs text-slate-400 mb-2">
              Blocked if marks are already recorded for this module there.
            </p>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400">No classes yet — create one on the Classes page first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {classes.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-slate-700 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editSelectedClassIds.includes(c.id)}
                      onChange={() => editToggleClass(c.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <ErrorText>{editError}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
