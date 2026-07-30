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
  FileSpreadsheet,
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

  function downloadStudentsExcel(classId, className) {
    const token = localStorage.getItem("token");
    fetch(`${api.defaults.baseURL}/classes/${classId}/students/excel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `students-${(className || "class").replace(/\s+/g, "-")}.xlsx`;
        link.click();
      });
  }

  // "Students" isn't its own grouping mode — it's a per-class breakdown of
  // the counts already fetched, shown in a small popup.
  function genderCounts(students) {
    let boys = 0;
    let girls = 0;
    for (const s of students) {
      if (s.sex === "M") boys += 1;
      else if (s.sex === "F") girls += 1;
    }
    return { boys, girls };
  }

  const studentsByClass = uniqueClassIds
    .map((classId) => {
      const a = assignments.find((x) => x.classId === classId);
      const students = studentsByClassId[classId] || [];
      const { boys, girls } = genderCounts(students);
      return {
        classId,
        className: a?.Class?.name || "—",
        count: studentCounts[classId] ?? null,
        boys,
        girls,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  const overallGender = genderCounts(uniqueClassIds.flatMap((id) => studentsByClassId[id] || []));

  const selectedClassInfo = studentsByClass.find((row) => row.classId === selectedClassId);
  const selectedClassStudents = (studentsByClassId[selectedClassId] || [])
    .slice()
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const selectedClassGender = genderCounts(selectedClassStudents);

  const groupedAssignments = buildGroups(groupBy);

  const stats = [
    {
      label: "Modules Assigned",
      value: assignments.length,
      icon: BookOpen,
      accent: "from-amber-400 to-amber-600",
      onClick: () => focusAssignments("module"),
      clickable: assignments.length > 0,
    },
    {
      label: "Classes Taught",
      value: uniqueClassIds.length,
      icon: Layers,
      accent: "from-teal-400 to-teal-600",
      onClick: () => focusAssignments("class"),
      clickable: assignments.length > 0,
    },
    {
      label: "Students",
      value: totalStudents,
      icon: Users,
      accent: "from-blue-400 to-blue-600",
      onClick: () => openStudentsModal(null),
      clickable: assignments.length > 0,
    },
    {
      label: "Class Teacher",
      value: classesTaught.length > 0 ? classesTaught.map((c) => c.name).join(", ") : "—",
      icon: Star,
      accent: "from-violet-400 to-violet-600",
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
      accent: "from-emerald-400 to-emerald-600",
    },
    {
      to: "/teacher/reports",
      label: "View Reports",
      hint: "See class rankings and download report cards",
      icon: FileText,
      accent: "from-brand-400 to-brand-600",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.onClick}
            disabled={!s.clickable}
            className={`group flex items-center gap-3 bg-white px-4 py-4 sm:px-5 text-left transition-colors
              ${s.clickable ? "hover:bg-slate-50 cursor-pointer" : "cursor-default opacity-70"}`}
          >
            <div
              className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.accent} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
            >
              <s.icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xl font-bold text-slate-800 leading-tight truncate"
                title={typeof s.value === "string" ? s.value : undefined}
              >
                {loading ? "…" : s.value}
              </div>
              <div className="text-xs text-slate-500 truncate">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.accent} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
            >
              <link.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{link.label}</p>
              <p className="text-sm text-slate-500">{link.hint}</p>
            </div>
            <ArrowRight size={16} className="ml-auto shrink-0 text-slate-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>

      {classesTaught.length > 0 && (
        <div ref={classTeacherRef}>
          <Card
            title={
              <span className="inline-flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-sm">
                  <Star size={15} />
                </span>
                Classes You're the Class Teacher For
              </span>
            }
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
          title={
            <span className="inline-flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm">
                <BookOpen size={15} />
              </span>
              Your Teaching Assignments
            </span>
          }
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
                    className="rounded-2xl border border-slate-200 overflow-hidden transition-all duration-200 hover:border-slate-300"
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
                      <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm">
                        <GroupIcon size={16} />
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  {selectedClassStudents.length} Total Student{selectedClassStudents.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {selectedClassGender.boys} Boys
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  {selectedClassGender.girls} Girls
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadStudentsExcel(selectedClassId, selectedClassInfo?.className)}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-teacher bg-white border border-teacher/30 hover:bg-teacher/10 px-2.5 py-1.5 rounded-md transition"
              >
                <FileSpreadsheet size={13} />
                Download Excel
              </button>
            </div>
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
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-sm">
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
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-slate-700">
                {totalStudents} Total Student{totalStudents === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                {overallGender.boys} Boys
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {overallGender.girls} Girls
              </span>
              <span className="text-slate-400">
                across {uniqueClassIds.length} class{uniqueClassIds.length !== 1 ? "es" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {studentsByClass.map((row) => (
                <div
                  key={row.classId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 hover:border-brand-300 hover:bg-slate-50 transition"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Layers size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {row.className}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                        <span>{row.count ?? "…"} Total</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          {row.boys} Boys
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          {row.girls} Girls
                        </span>
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedClassId(row.classId)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 shadow-sm transition"
                  >
                    <FileText size={13} />
                    Class Report
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
