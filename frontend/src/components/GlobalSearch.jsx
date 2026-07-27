import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, GraduationCap, Users, Layers, CalendarRange, BookOpen, Loader2 } from "lucide-react";
import api from "../api/client";

// Live header search across students and teachers (manager only — same
// audience as the Students/Teachers pages this links back into). Debounced
// so it doesn't fire a request on every keystroke, and closes on outside
// click / Escape / route change like the other header popovers.
export default function GlobalSearch() {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ students: [], teachers: [] });
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults({ students: [], teachers: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/search", { params: { q } });
        setResults({ students: data.students || [], teachers: data.teachers || [] });
        setActiveIndex(-1);
      } catch {
        setResults({ students: [], teachers: [] });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const flatResults = [
    ...results.students.map((r) => ({ kind: "student", data: r })),
    ...results.teachers.map((r) => ({ kind: "teacher", data: r })),
  ];

  function goToStudent(s) {
    setOpen(false);
    setQuery("");
    navigate(`/manager/students?classId=${s.classId}&highlight=${s.id}`);
  }

  function goToTeacher(t) {
    setOpen(false);
    setQuery("");
    navigate(`/manager/teachers?highlight=${t.id}`);
  }

  function selectResult(item) {
    if (!item) return;
    if (item.kind === "student") goToStudent(item.data);
    else goToTeacher(item.data);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(flatResults[activeIndex] || flatResults[0]);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div className="relative hidden md:block w-56 lg:w-72" ref={wrapRef}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search students, teachers…"
          className="form-field w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 py-1.5 text-sm text-slate-800
            placeholder:text-slate-400 focus:bg-white focus:border-brand-400 focus:ring-0 outline-none transition shadow-none"
        />
        {loading ? (
          <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 animate-spin" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X size={13} />
            </button>
          )
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 w-[22rem] max-w-[85vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="max-h-[26rem] overflow-y-auto">
            {!loading && flatResults.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                No students or teachers match "{query.trim()}"
              </p>
            )}

            {results.students.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Students
                </p>
                {results.students.map((s, idx) => {
                  const flatIdx = idx;
                  const active = flatIdx === activeIndex;
                  return (
                    <button
                      key={`student-${s.id}`}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() => goToStudent(s)}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-3 border-b border-slate-50 last:border-b-0 transition
                        ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="h-8 w-8 shrink-0 rounded-full bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center text-brand-600">
                        <GraduationCap size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {s.firstName} {s.lastName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                          {s.className ? (
                            <span className="flex items-center gap-1">
                              <Layers size={10} /> {s.className}
                            </span>
                          ) : (
                            <span className="text-slate-400">No class</span>
                          )}
                          {s.academicYearName && (
                            <span className="flex items-center gap-1">
                              <CalendarRange size={10} /> {s.academicYearName}
                            </span>
                          )}
                          {s.admissionNumber && <span className="text-slate-400">#{s.admissionNumber}</span>}
                        </div>
                      </div>
                      {s.status === "inactive" && (
                        <span className="shrink-0 rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium">
                          Inactive
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {results.teachers.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Teachers
                </p>
                {results.teachers.map((t, idx) => {
                  const flatIdx = results.students.length + idx;
                  const active = flatIdx === activeIndex;
                  return (
                    <button
                      key={`teacher-${t.id}`}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() => goToTeacher(t)}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-3 border-b border-slate-50 last:border-b-0 transition
                        ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                    >
                      <div className="h-8 w-8 shrink-0 rounded-full bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center text-teal-600">
                        <Users size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                        {t.classes.length > 0 ? (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {t.classes.slice(0, 3).map((c) => (
                              <span
                                key={c.classId}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px]"
                                title={c.isHomeroom ? "Class teacher" : c.modules.join(", ")}
                              >
                                <Layers size={9} /> {c.className}
                                {c.isHomeroom && " · Homeroom"}
                              </span>
                            ))}
                            {t.classes.length > 3 && (
                              <span className="text-[10px] text-slate-400 self-center">
                                +{t.classes.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-slate-400">No class assigned yet</p>
                        )}
                      </div>
                      {t.status === "suspended" && (
                        <span className="shrink-0 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-medium">
                          Suspended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
