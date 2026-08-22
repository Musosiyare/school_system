import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import { usePagination } from "../../hooks/usePagination";
import { Field, Input, IconInput, IconSelect } from "../../components/ui/FormField";
import ClassDropdown from "../../components/ui/ClassDropdown";
import { ErrorText } from "../../components/ui/Alerts";
import { useConfirm } from "../../components/ui/ConfirmProvider";
import { useNotify } from "../../components/ui/NotifyProvider";
import { Pencil, Trash2, Plus, BookOpen, ChevronDown, School2, Hash, Gauge, ListFilter, Search, Power, PowerOff } from "lucide-react";

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

// Soft gradient avatar per module type, used on the live-search result
// cards so each result reads as a distinct little "chip" rather than a
// wall of identical rows.
const MODULE_TYPE_GRADIENT = {
  specific: "from-amber-400 to-amber-600",
  general: "from-sky-400 to-sky-600",
  complementary: "from-violet-400 to-violet-600",
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

function ModuleGroupPanel({ group, isExpanded, onToggle, openEdit, handleDelete, handleToggleActive }) {
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
          <div className="p-3">
            <Table>
              <Thead>
                <tr>
                  <Th className="w-28">Code</Th>
                  <Th>Name</Th>
                  <Th className="w-40">Type</Th>
                  <Th className="w-24">Weight</Th>
                  <Th className="w-32">Passing Line</Th>
                  <Th className="w-24">Status</Th>
                  <Th className="w-32 text-right">Actions</Th>
                </tr>
              </Thead>
              <tbody>
                {pageItems.length === 0 && <EmptyRow colSpan={7}>No modules here yet.</EmptyRow>}
                {pageItems.map((m) => (
                  <tr key={m.id} className={`hover:bg-slate-50/80 ${m.isActive === false ? "opacity-60" : ""}`}>
                    <Td className="font-mono text-xs text-slate-500">{m.moduleCode}</Td>
                    <Td className="font-medium text-slate-700">{m.moduleTitle}</Td>
                    <Td>
                      <span
                        className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
                          MODULE_TYPE_BADGE[m.moduleType] || MODULE_TYPE_BADGE.general
                        }`}
                      >
                        {moduleTypeLabel(m.moduleType)}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{m.moduleWeight}</Td>
                    <Td className="tabular-nums">{m.passingLine}</Td>
                    <Td>
                      {m.isActive === false ? (
                        <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                          Active
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={m.isActive === false ? "success" : "danger"}
                          onClick={() => handleToggleActive(m)}
                          title={m.isActive === false ? "Reactivate this module" : "Deactivate this module"}
                        >
                          {m.isActive === false ? <Power size={14} /> : <PowerOff size={14} />}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(m)}
                          disabled={m.isActive === false}
                          title={m.isActive === false ? "Reactivate this module to edit it" : "Edit"}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(m)}
                          disabled={m.isActive === false}
                          title={m.isActive === false ? "Reactivate this module to delete it" : "Delete"}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
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

  // Live search — typing here searches across every module by code or name
  // (regardless of class) and shows, per match, which class(es) it belongs
  // to plus its type and weight, so the admin doesn't have to open each
  // class's accordion group to find one module.
  const [search, setSearch] = useState("");

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

  async function handleToggleActive(m) {
    const next = m.isActive === false;
    if (!next) {
      const ok = await confirm({
        title: `Deactivate ${m.moduleTitle}?`,
        message:
          "Teachers will no longer be able to record marks for this module in any class, and it will be dropped from report cards, until you reactivate it.",
        confirmText: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/modules/${m.id}/status`, { isActive: next });
      await load();
    } catch (err) {
      notify({ title: "Couldn't update module", message: err.message, tone: "error" });
    }
  }

  const filteredModules =
    classFilter === "all"
      ? modules
      : modules.filter((m) => (m.ClassModules || []).some((cm) => String(cm.classId) === String(classFilter)));

  // Live search results — matched purely by code/title against the FULL
  // module list (not classFilter-scoped), each annotated with the class(es)
  // it belongs to so the admin gets everything they need (class, type,
  // weight) straight from the search without drilling into a group.
  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? modules.filter(
        (m) =>
          m.moduleCode?.toLowerCase().includes(searchQuery) ||
          m.moduleTitle?.toLowerCase().includes(searchQuery)
      )
    : [];

  // `classes` only ever holds the active academic year's classes (that's
  // the server's default for GET /classes), but a module's own ClassModules
  // can still carry rows from past years it was taught in. Cross-referencing
  // against `classes` here keeps the search results to just this year's
  // classes instead of surfacing every year the module has ever been taught.
  const currentYearClassIds = new Set(classes.map((c) => c.id));

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search module code or name..."
              className="form-field w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800
                placeholder:text-slate-400 outline-none transition focus:border-black focus:ring-0 shadow-none"
            />
          </div>
          <ClassDropdown classes={classes} value={classFilter} onChange={setClassFilter} allLabel="All classes" />
        </div>

        {searchQuery ? (
          // Live search results — flat, class-agnostic "beauty" cards instead
          // of a plain table row, since results can span several class
          // groups and this is the view meant to be scanned at a glance.
          <div className="flex flex-col gap-2.5">
            {searchResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
                <Search size={22} className="text-slate-300" />
                No modules match "{search.trim()}".
              </div>
            )}
            {searchResults.map((m) => {
              const classNames = (m.ClassModules || [])
                .filter((cm) => currentYearClassIds.has(cm.classId))
                .map((cm) => cm.Class?.name)
                .filter(Boolean);
              const inactive = m.isActive === false;
              return (
                <div
                  key={m.id}
                  className={`group flex items-start gap-3.5 rounded-2xl border bg-white p-4 transition ${
                    inactive
                      ? "border-slate-200 opacity-60"
                      : "border-slate-200 hover:border-brand-300 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${
                      MODULE_TYPE_GRADIENT[m.moduleType] || MODULE_TYPE_GRADIENT.general
                    }`}
                  >
                    <BookOpen size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-400">{m.moduleCode}</span>
                      <span className="font-semibold text-slate-800">{m.moduleTitle}</span>
                      <span
                        className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
                          MODULE_TYPE_BADGE[m.moduleType] || MODULE_TYPE_BADGE.general
                        }`}
                      >
                        {moduleTypeLabel(m.moduleType)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                        <Gauge size={12} className="text-slate-400" /> Weight {m.moduleWeight}
                      </span>
                      {inactive && (
                        <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {classNames.length === 0 ? (
                        <span className="text-xs text-slate-400">Not taught in any class this year</span>
                      ) : (
                        classNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100"
                          >
                            <School2 size={10} /> {name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      size="sm"
                      variant={inactive ? "success" : "danger"}
                      onClick={() => handleToggleActive(m)}
                      title={inactive ? "Reactivate this module" : "Deactivate this module"}
                    >
                      {inactive ? <Power size={14} /> : <PowerOff size={14} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(m)}
                      disabled={inactive}
                      title={inactive ? "Reactivate this module to edit it" : "Edit"}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
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
                  handleToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </>
        )}
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
