import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Layers, BookOpen, Users, GraduationCap, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]); // raw classes from API
  const [teachers, setTeachers] = useState([]);
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState({}); // classId -> [students]

  // Which stat drawer is open, and drill-down state within it.
  const [activeStat, setActiveStat] = useState(null); // "classes" | "teachers" | "students" | "modules" | null
  const [selectedId, setSelectedId] = useState(null); // id of the item drilled into, or null for the list view

  useEffect(() => {
    (async () => {
      const [classesRes, teachersRes, modulesRes, assignmentsRes] = await Promise.all([
        api.get("/classes"),
        api.get("/teachers"),
        api.get("/modules"),
        api.get("/assignments"),
      ]);
      const classList = classesRes.data.classes;
      const studentLists = await Promise.all(
        classList.map((c) => api.get(`/classes/${c.id}/students`).then((r) => r.data.students))
      );
      const map = {};
      classList.forEach((c, idx) => {
        map[c.id] = studentLists[idx] || [];
      });

      setClasses(classList);
      setTeachers(teachersRes.data.teachers);
      setModules(modulesRes.data.modules);
      setAssignments(assignmentsRes.data.assignments);
      setStudentsByClass(map);
      setLoading(false);
    })();
  }, []);

  const totalStudents = Object.values(studentsByClass).reduce((sum, list) => sum + list.length, 0);

  const stats = [
    { key: "classes", label: "Classes", value: classes.length, icon: Layers },
    { key: "teachers", label: "Teachers", value: teachers.length, icon: Users },
    { key: "students", label: "Students", value: totalStudents, icon: GraduationCap },
    { key: "modules", label: "Modules", value: modules.length, icon: BookOpen },
  ];

  function openStat(key) {
    setActiveStat(key);
    setSelectedId(null);
  }

  function closeStat() {
    setActiveStat(null);
    setSelectedId(null);
  }

  const steps = [
    { to: "/manager/academic-years", label: "Create an Academic Year", hint: "auto-creates Term 1, 2, 3" },
    { to: "/manager/classes", label: "Create Classes" },
    { to: "/manager/modules", label: "Create Modules and assign them to classes" },
    { to: "/manager/teachers", label: "Create Teacher accounts" },
    { to: "/manager/assignments", label: "Assign teachers to modules/classes, and a class teacher" },
    { to: "/manager/students", label: "Enroll students" },
  ];

  // --- Derived helpers for drill-down detail views ---

  function teachersForClass(classId) {
    const map = new Map();
    assignments
      .filter((a) => a.classId === classId && a.teacher)
      .forEach((a) => {
        if (!map.has(a.teacher.id)) map.set(a.teacher.id, { ...a.teacher, modules: [] });
        map.get(a.teacher.id).modules.push(a.Module?.moduleTitle);
      });
    return Array.from(map.values());
  }

  function classesForTeacher(teacherId) {
    const map = new Map();
    assignments
      .filter((a) => a.teacherId === teacherId)
      .forEach((a) => {
        if (!a.Class) return;
        if (!map.has(a.Class.id)) map.set(a.Class.id, { ...a.Class, modules: [] });
        map.get(a.Class.id).modules.push(a.Module?.moduleTitle);
      });
    return Array.from(map.values());
  }

  function classesForModule(moduleId) {
    const m = modules.find((mm) => mm.id === moduleId);
    return (m?.ClassModules || []).map((cm) => cm.Class).filter(Boolean);
  }

  // --- Modal content per stat ---

  function renderStatModal() {
    if (!activeStat) return null;

    const titles = { classes: "Classes", teachers: "Teachers", students: "Students", modules: "Modules" };
    const selected = selectedId != null;

    return (
      <Modal
        open={!!activeStat}
        onClose={closeStat}
        size="md"
        title={
          <span className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">
                <ChevronLeft size={18} />
              </button>
            )}
            {titles[activeStat]}
          </span>
        }
      >
        {activeStat === "classes" && !selected && (
          <ListView
            items={classes}
            empty="No classes yet."
            render={(c) => (
              <>
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-400">
                  {(studentsByClass[c.id] || []).length} student
                  {(studentsByClass[c.id] || []).length === 1 ? "" : "s"}
                </span>
              </>
            )}
            onSelect={(c) => setSelectedId(c.id)}
          />
        )}
        {activeStat === "classes" && selected && (
          <ClassDetail
            klass={classes.find((c) => c.id === selectedId)}
            teachers={teachersForClass(selectedId)}
            students={studentsByClass[selectedId] || []}
          />
        )}

        {activeStat === "teachers" && !selected && (
          <ListView
            items={teachers}
            empty="No teachers yet."
            render={(t) => (
              <>
                <span className="font-medium text-slate-800">{t.name}</span>
                <span className="text-xs text-slate-400">{t.email}</span>
              </>
            )}
            onSelect={(t) => setSelectedId(t.id)}
          />
        )}
        {activeStat === "teachers" && selected && (
          <TeacherDetail
            teacher={teachers.find((t) => t.id === selectedId)}
            classes={classesForTeacher(selectedId)}
          />
        )}

        {activeStat === "students" && !selected && (
          <ListView
            items={classes}
            empty="No classes yet."
            render={(c) => (
              <>
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-400">
                  {(studentsByClass[c.id] || []).length} student
                  {(studentsByClass[c.id] || []).length === 1 ? "" : "s"}
                </span>
              </>
            )}
            onSelect={(c) => setSelectedId(c.id)}
          />
        )}
        {activeStat === "students" && selected && (
          <StudentRoster
            klass={classes.find((c) => c.id === selectedId)}
            students={studentsByClass[selectedId] || []}
          />
        )}

        {activeStat === "modules" && !selected && (
          <ListView
            items={modules}
            empty="No modules yet."
            render={(m) => (
              <>
                <span className="font-medium text-slate-800">{m.moduleTitle}</span>
                <span className="text-xs text-slate-400 font-mono">{m.moduleCode}</span>
              </>
            )}
            onSelect={(m) => setSelectedId(m.id)}
          />
        )}
        {activeStat === "modules" && selected && (
          <ModuleDetail
            module={modules.find((m) => m.id === selectedId)}
            classes={classesForModule(selectedId)}
          />
        )}
      </Modal>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => openStat(s.key)}
            disabled={loading}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition-colors disabled:cursor-wait"
          >
            <div className="flex items-center justify-between mb-2">
              <s.icon className="text-brand-500" size={20} />
              <ChevronRight size={16} className="text-slate-300" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{loading ? "…" : s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </button>
        ))}
      </div>

      <Card title="Getting Started">
        <ol className="space-y-2">
          {steps.map((step, idx) => (
            <li key={step.to}>
              <Link
                to={step.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 group"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 text-xs font-semibold">
                  {idx + 1}
                </span>
                <span className="text-sm text-slate-700">
                  {step.label}
                  {step.hint && <span className="text-slate-400"> ({step.hint})</span>}
                </span>
                <ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-brand-400" />
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      {renderStatModal()}
    </div>
  );
}

// A simple clickable list used as the first level of every drill-down.
function ListView({ items, empty, render, onSelect }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 text-left"
        >
          <span className="flex flex-col">{render(item)}</span>
          <ChevronRight size={15} className="text-slate-300 shrink-0" />
        </button>
      ))}
    </div>
  );
}

function ClassDetail({ klass, teachers, students }) {
  if (!klass) return null;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Academic Year</p>
        <p className="text-sm text-slate-700">{klass.AcademicYear?.name || "-"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Class Teacher</p>
        <p className="text-sm text-slate-700">
          {klass.classTeacher ? klass.classTeacher.name : <span className="text-slate-400 italic">Unassigned</span>}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">
          Teachers & modules ({teachers.length})
        </p>
        {teachers.length === 0 ? (
          <p className="text-sm text-slate-400">No teacher assignments yet.</p>
        ) : (
          <ul className="space-y-1">
            {teachers.map((t) => (
              <li key={t.id} className="text-sm text-slate-700">
                <span className="font-medium">{t.name}</span>{" "}
                <span className="text-slate-400">— {t.modules.join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Students ({students.length})</p>
        {students.length === 0 ? (
          <p className="text-sm text-slate-400">No students enrolled yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {students.map((s) => (
              <li key={s.id} className="text-sm text-slate-700">
                {s.firstName} {s.lastName}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TeacherDetail({ teacher, classes }) {
  if (!teacher) return null;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Email</p>
        <p className="text-sm text-slate-700">{teacher.email}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">
          Teaches in {classes.length} class{classes.length === 1 ? "" : "es"}
        </p>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-400">No assignments yet.</p>
        ) : (
          <ul className="space-y-1">
            {classes.map((c) => (
              <li key={c.id} className="text-sm text-slate-700">
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-slate-400">— {c.modules.join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StudentRoster({ klass, students }) {
  if (!klass) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-2">
        {klass.name} — {students.length} student{students.length === 1 ? "" : "s"}
      </p>
      {students.length === 0 ? (
        <p className="text-sm text-slate-400">No students enrolled yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {students.map((s) => (
            <li key={s.id} className="text-sm text-slate-700 rounded-md px-2 py-1.5 hover:bg-slate-50">
              {s.firstName} {s.lastName}
              {s.admissionNumber && (
                <span className="text-xs text-slate-400 ml-2">#{s.admissionNumber}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModuleDetail({ module, classes }) {
  if (!module) return null;
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Code</p>
          <p className="text-sm text-slate-700 font-mono">{module.moduleCode}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Weight / Max Score</p>
          <p className="text-sm text-slate-700">{module.moduleWeight}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Passing Line</p>
          <p className="text-sm text-slate-700">{module.passingLine}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">
          Taught in {classes.length} class{classes.length === 1 ? "" : "es"}
        </p>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-400">Not assigned to any class yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {classes.map((c) => (
              <Badge key={c.id} tone="neutral">
                {c.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
