import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, Select } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import { Table, Thead, Th, Td, EmptyRow } from "../../components/ui/Table";
import SearchInput from "../../components/ui/SearchInput";
import { Settings, Plus, Layers, Eye, BookOpen, UserCircle2 } from "lucide-react";

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [viewingModules, setViewingModules] = useState(null); // class whose modules are being viewed, or null
  const [managing, setManaging] = useState(null); // class being managed, or null
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [manageError, setManageError] = useState("");
  const [manageSuccess, setManageSuccess] = useState("");
  const [savingManage, setSavingManage] = useState(false);
  const [query, setQuery] = useState("");

  async function loadAll() {
    const [classesRes, yearsRes, teachersRes, assignmentsRes] = await Promise.all([
      api.get("/classes"),
      api.get("/academic-years"),
      api.get("/teachers"),
      api.get("/assignments"),
    ]);
    setClasses(classesRes.data.classes);
    setYears(yearsRes.data.academicYears);
    setTeachers(teachersRes.data.teachers);
    setAssignments(assignmentsRes.data.assignments);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openCreate() {
    setName("");
    // Only the current academic year is ever offered here, so pre-select it
    // when there is one instead of making the manager pick from a list of one.
    setAcademicYearId(years[0] ? String(years[0].id) : "");
    setError("");
    setCreating(true);
  }

  async function handleCreateClass(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/classes", { name, academicYearId: Number(academicYearId) });
      setCreating(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openManage(klass) {
    setManaging(klass);
    setSelectedModuleIds((klass.ClassModules || []).map((cm) => cm.moduleId));
    setSelectedTeacherId(klass.classTeacher?.id ? String(klass.classTeacher.id) : "");
    setManageError("");
    setManageSuccess("");
  }

  // Only this class's own modules — not the full school catalog. Adding a
  // module to a class now happens on the Assignments page (assign a teacher)
  // or the Modules page (check this class off there); this modal is for
  // viewing/removing what's already here.
  const classModulesForManaging = (managing?.ClassModules || [])
    .map((cm) => cm.Module)
    .filter(Boolean);

  function toggleModule(moduleId) {
    setSelectedModuleIds((ids) =>
      ids.includes(moduleId) ? ids.filter((id) => id !== moduleId) : [...ids, moduleId]
    );
  }

  async function handleSaveManage() {
    setManageError("");
    setManageSuccess("");
    setSavingManage(true);
    try {
      await api.put(`/classes/${managing.id}/modules`, { moduleIds: selectedModuleIds });
      await api.post(`/classes/${managing.id}/assign-teacher`, {
        teacherId: selectedTeacherId ? Number(selectedTeacherId) : null,
      });
      await loadAll();
      setManageSuccess("Saved.");
    } catch (err) {
      setManageError(err.message);
    } finally {
      setSavingManage(false);
    }
  }

  const filteredClasses = classes.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.AcademicYear?.name, c.classTeacher?.name]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}>
          <Plus size={16} /> New Class
        </Button>
      </div>

      <Card
        title="All Classes"
        subtitle="Click Manage to set the class teacher or view its modules."
        actions={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by class or teacher..."
            className="w-64"
          />
        }
      >
        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Academic Year</Th>
              <Th>Class Teacher</Th>
              <Th>Modules</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {classes.length === 0 && (
              <EmptyRow colSpan={5}>
                <div className="flex flex-col items-center gap-2 py-2">
                  <Layers size={22} className="text-slate-300" />
                  No classes yet. Click "New Class" to create one.
                </div>
              </EmptyRow>
            )}
            {classes.length > 0 && filteredClasses.length === 0 && (
              <EmptyRow colSpan={5}>No classes match "{query}".</EmptyRow>
            )}
            {filteredClasses.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium text-slate-800">{c.name}</Td>
                <Td className="text-slate-500">{c.AcademicYear?.name || "-"}</Td>
                <Td>
                  {c.classTeacher ? c.classTeacher.name : <Badge tone="warning">Unassigned</Badge>}
                </Td>
                <Td>
                  {(c.ClassModules || []).length === 0 ? (
                    <span className="text-slate-400 text-sm">None</span>
                  ) : (
                    <button
                      onClick={() => setViewingModules(c)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white pl-2.5 pr-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
                      title="View all modules in this class"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <Eye size={13} />
                      </span>
                      <span className="font-medium">
                        {c.ClassModules.length} module{c.ClassModules.length > 1 ? "s" : ""}
                      </span>
                    </button>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => openManage(c)}>
                      <Settings size={14} /> Manage
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Create modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Class"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClass} disabled={saving}>
              {saving ? "Creating..." : "Create Class"}
            </Button>
          </>
        }
      >
        <form noValidate onSubmit={handleCreateClass} className="space-y-4">
          <Field label="Class Name (e.g. S2A)">
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Academic Year">
            <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} required>
              <option value="">Select year</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
          {years.length === 0 && (
            <p className="text-xs text-amber-600">
              No current academic year is set. Go to Academic Years and mark one as current first.
            </p>
          )}
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      {/* Manage modal */}
      <Modal
        open={!!managing}
        onClose={() => setManaging(null)}
        title={`Manage ${managing?.name || ""}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManaging(null)}>
              Close
            </Button>
            <Button onClick={handleSaveManage} disabled={savingManage}>
              {savingManage ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Class Teacher</p>
            <p className="text-xs text-slate-400 mb-2">
              Manages this class's reports. Doesn't have to teach here themselves.
            </p>
            <Select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)}>
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Modules taught in this class
            </p>
            {classModulesForManaging.length === 0 ? (
              <p className="text-sm text-slate-400">
                None yet — assign a teacher on the Assignments page, or add one on the Modules page.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {classModulesForManaging.map((m) => {
                  const subjectTeacher = assignments.find(
                    (a) => a.classId === managing?.id && a.moduleId === m.id
                  )?.teacher?.name;
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-sm text-slate-700 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.includes(m.id)}
                        onChange={() => toggleModule(m.id)}
                        className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
                      />
                      <span className="flex-1 truncate">
                        <span>
                          {m.moduleTitle} <span className="text-xs text-slate-400">/{m.maxScore}</span>
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {subjectTeacher || "No teacher assigned"}
                        </div>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Removing a module is blocked if it already has marks recorded.
            </p>
          </div>

          <ErrorText>{manageError}</ErrorText>
          <SuccessText>{manageSuccess}</SuccessText>
        </div>
      </Modal>

      {/* View modules modal */}
      <Modal
        open={!!viewingModules}
        onClose={() => setViewingModules(null)}
        title={viewingModules ? `${viewingModules.name} — Modules` : ""}
        size="lg"
        footer={<Button onClick={() => setViewingModules(null)}>Close</Button>}
      >
        {viewingModules && (() => {
          const mods = (viewingModules.ClassModules || [])
            .map((cm) => cm.Module)
            .filter(Boolean);
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-sm text-brand-700">
                <BookOpen size={15} />
                <span>
                  <span className="font-semibold">{mods.length}</span> module{mods.length !== 1 ? "s" : ""} taught in{" "}
                  <span className="font-semibold">{viewingModules.name}</span>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 max-h-[26rem] overflow-y-auto pr-1">
                {mods.map((m) => {
                  const subjectTeacher = assignments.find(
                    (a) => a.classId === viewingModules.id && a.moduleId === m.id
                  )?.teacher?.name;
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-slate-200 px-3.5 py-3 hover:border-brand-200 hover:bg-brand-50/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.moduleTitle}</p>
                          {m.moduleCode && <p className="text-xs text-slate-400">{m.moduleCode}</p>}
                        </div>
                        <Badge tone="manager" className="shrink-0">
                          /{m.maxScore}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <UserCircle2 size={13} className="text-slate-400" />
                        {subjectTeacher || (
                          <span className="text-amber-600 font-medium">No teacher assigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
