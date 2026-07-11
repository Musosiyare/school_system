import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  BookOpen,
  Layers,
  Users,
  Star,
  PencilLine,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Phone,
  UserCircle,
} from "lucide-react";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [classesTaught, setClassesTaught] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [studentsByClassId, setStudentsByClassId] = useState({});
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState("class"); // "class" | "module"
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const assignmentsRef = useRef(null);
  const classTeacherRef = useRef(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);

  useEffect(() => {
    (async () => {
      const [assignmentsRes, classesRes] = await Promise.all([
        api.get(`/teachers/${user.id}/assignments`),
        api.get("/classes"),
      ]);
      setAssignments(assignmentsRes.data.assignments);

      const owned = classesRes.data.classes.filter((c) => c.classTeacher?.id === user.id);
      setClassesTaught(owned);

      // Distinct classes this teacher has a module assignment in, for a
      // "students taught" estimate.
      const uniqueClassIds = [
        ...new Set(assignmentsRes.data.assignments.map((a) => a.classId)),
      ];
      const counts = {};
      const studentsMap = {};
      await Promise.all(
        uniqueClassIds.map(async (classId) => {
          const { data } = await api.get(`/classes/${classId}/students`);
          counts[classId] = data.students.length;
          studentsMap[classId] = data.students;
        })
      );
      setStudentCounts(counts);
      setStudentsByClassId(studentsMap);
      setLoading(false);
    })();
  }, [user.id]);

  const uniqueClassIds = [...new Set(assignments.map((a) => a.classId))];
  const totalStudents = uniqueClassIds.reduce((sum, id) => sum + (studentCounts[id] || 0), 0);

  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function switchGroupBy(mode) {
    setGroupBy(mode);
    setExpandedGroups(new Set());
  }

  function keyFor(mode, a) {
    return mode === "class" ? `class-${a.classId}` : `module-${a.moduleId}`;
  }

  function buildGroups(mode) {
    const map = new Map();
    for (const a of assignments) {
      const key = keyFor(mode, a);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: mode === "class" ? a.Class?.name : a.Module?.moduleTitle,
          items: [],
        });
      }
      map.get(key).items.push(a);
    }
    return [...map.values()].sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }

  // Stat cards double as shortcuts: clicking Modules/Classes switches the
  // assignments view to the matching grouping and scrolls it into view
  // (left collapsed — the person can expand whichever row they care about).
  function focusAssignments(mode) {
    if (assignments.length === 0) return;
    setGroupBy(mode);
    setExpandedGroups(new Set());
    assignmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusClassTeacher() {
    if (classesTaught.length === 0) return;
    classTeacherRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Students are always viewed through a class — either pick a class first
  // (from the stat card) or jump straight into one (from a class badge/group).
  function openStudentsModal(classId = null) {
    setSelectedClassId(classId);
    setShowStudentsModal(true);
  }

  // "Students" isn't its own grouping mode — it's a per-class breakdown of
  // the counts already fetched, shown in a small popup.
  const studentsByClass = uniqueClassIds
    .map((classId) => {
      const a = assignments.find((x) => x.classId === classId);
      return { classId, className: a?.Class?.name || "—", count: studentCounts[classId] ?? null };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  const selectedClassInfo = studentsByClass.find((row) => row.classId === selectedClassId);
  const selectedClassStudents = (studentsByClassId[selectedClassId] || [])
    .slice()
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const groupedAssignments = buildGroups(groupBy);

  const stats = [
    {
      label: "Modules Assigned",
      value: assignments.length,
      icon: BookOpen,
      onClick: () => focusAssignments("module"),
      clickable: assignments.length > 0,
    },
    {
      label: "Classes Taught",
      value: uniqueClassIds.length,
      icon: Layers,
      onClick: () => focusAssignments("class"),
      clickable: assignments.length > 0,
    },
    {
      label: "Students (est.)",
      value: totalStudents,
      icon: Users,
      onClick: () => openStudentsModal(null),
      clickable: assignments.length > 0,
    },
    {
      label: "Class Teacher Of",
      value: classesTaught.length,
      icon: Star,
      onClick: focusClassTeacher,
      clickable: classesTaught.length > 0,
    },
  ];

  const quickLinks = [
    {
      to: "/teacher/marks",
      label: "Record Marks",
      hint: "Enter or update scores for your assigned modules",
      icon: PencilLine,
    },
    {
      to: "/teacher/reports",
      label: "View Reports",
      hint: "See class rankings and download report cards",
      icon: FileText,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onClick}
            disabled={!s.clickable}
            className={`group text-left bg-white border border-slate-200 rounded-xl p-4 sm:p-5 transition
              ${s.clickable ? "hover:border-brand-300 hover:shadow-sm cursor-pointer" : "cursor-default opacity-70"}`}
          >
            <div className="flex items-start justify-between">
              <s.icon className="text-brand-600 mb-2" size={20} />
              {s.clickable && (
                <ArrowRight
                  size={14}
                  className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition"
                />
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-800">{loading ? "…" : s.value}</div>
            <div className="text-xs sm:text-sm text-slate-500">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm transition"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <link.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{link.label}</p>
              <p className="text-sm text-slate-500">{link.hint}</p>
            </div>
            <ArrowRight size={16} className="ml-auto shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>

      {classesTaught.length > 0 && (
        <div ref={classTeacherRef}>
          <Card
            title="Classes You're the Class Teacher For"
            subtitle="You're responsible for remarks and overall report sign-off for these classes."
          >
            <div className="flex flex-wrap gap-2">
              {classesTaught.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openStudentsModal(c.id)}
                  className="rounded-full transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <Badge tone="teacher">{c.name}</Badge>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div ref={assignmentsRef}>
        <Card
          title="Your Teaching Assignments"
          subtitle="Modules and classes assigned to you."
          actions={
            assignments.length > 0 && (
              <Tabs
                tabs={[
                  { value: "class", label: "By Class", icon: Layers },
                  { value: "module", label: "By Module", icon: BookOpen },
                ]}
                active={groupBy}
                onChange={switchGroupBy}
              />
            )
          }
        >
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              You haven't been assigned any modules yet — check back once your school manager sets
              this up.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {groupedAssignments.map((group) => {
                const isOpen = expandedGroups.has(group.key);
                const GroupIcon = groupBy === "class" ? Layers : BookOpen;
                return (
                  <div
                    key={group.key}
                    className="rounded-xl border border-slate-200 overflow-hidden transition"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleGroup(group.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleGroup(group.key);
                      }}
                      className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 bg-white hover:bg-slate-50 transition text-left cursor-pointer"
                    >
                      <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                        <GroupIcon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-800 truncate text-sm sm:text-base">
                          {group.label || "—"}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {group.items.length} {groupBy === "class" ? "module" : "class"}
                          {group.items.length > 1 ? "s" : ""}
                        </span>
                      </span>
                      <Badge tone="teacher" className="shrink-0 hidden sm:inline-flex">
                        {group.items.length}
                      </Badge>
                      {groupBy === "class" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentsModal(group.items[0]?.classId);
                          }}
                          className="shrink-0 hidden sm:flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-md hover:bg-brand-50 transition"
                        >
                          <Users size={13} />
                          Students
                        </button>
                      )}
                      <ChevronDown
                        size={17}
                        className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-3 sm:px-4 py-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.items.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5"
                            >
                              {groupBy === "class" ? (
                                <>
                                  <p className="text-sm font-medium text-slate-800 truncate">
                                    {a.Module?.moduleTitle}
                                  </p>
                                  {a.Module?.moduleCode && (
                                    <p className="text-xs text-slate-400">{a.Module.moduleCode}</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {a.Class?.name}
                                </p>
                              )}
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <Users size={12} className="text-slate-400" />
                                {studentCounts[a.classId] ?? "…"} student
                                {studentCounts[a.classId] === 1 ? "" : "s"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={showStudentsModal}
        onClose={() => setShowStudentsModal(false)}
        title={selectedClassId ? `${selectedClassInfo?.className || "Class"} Students` : "Select a Class"}
        footer={
          selectedClassId ? (
            <Button variant="secondary" onClick={() => setSelectedClassId(null)}>
              <ChevronLeft size={15} />
              Back to Classes
            </Button>
          ) : (
            <Button onClick={() => setShowStudentsModal(false)}>Close</Button>
          )
        }
      >
        {selectedClassId ? (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {selectedClassStudents.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No students found in this class yet.
              </p>
            ) : (
              selectedClassStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <UserCircle size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {s.firstName} {s.lastName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        {s.guardianName || "No guardian on file"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        {s.guardianPhone || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-sm text-brand-700">
              <Users size={15} />
              <span>
                <span className="font-semibold">{totalStudents}</span> student
                {totalStudents !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold">{uniqueClassIds.length}</span> class
                {uniqueClassIds.length !== 1 ? "es" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-400 -mt-2">Pick a class to see its students.</p>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {studentsByClass.map((row) => (
                <button
                  key={row.classId}
                  type="button"
                  onClick={() => setSelectedClassId(row.classId)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50/50 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                      <Layers size={15} />
                    </span>
                    <span className="text-sm font-medium text-slate-800">{row.className}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge tone="teacher">
                      {row.count ?? "…"} student{row.count === 1 ? "" : "s"}
                    </Badge>
                    <ArrowRight size={14} className="text-slate-300" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
