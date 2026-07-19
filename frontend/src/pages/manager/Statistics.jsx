import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import AccordionSection from "../../components/ui/AccordionSection";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ArchivedYearBanner from "../../components/ArchivedYearBanner";
import { useYear } from "../../context/YearContext";
import { Field, Select } from "../../components/ui/FormField";
import { useNotify } from "../../components/ui/NotifyProvider";
import { Table, Thead, Th, Td } from "../../components/ui/Table";
import {
  Users,
  Mars,
  Venus,
  GraduationCap,
  Layers,
  BookOpen,
  Trophy,
  TrendingUp,
  TrendingDown,
  Medal,
  Crown,
  Info,
  FileDown,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Check,
} from "lucide-react";

// Sentinel value for the "Whole School" option in the class select — kept
// distinct from any real class id (which are numbers).
const SCHOOL_SCOPE = "__school__";

const GENDER_OPTIONS = [
  { value: "all", label: "All Students" },
  { value: "M", label: "Boys Only" },
  { value: "F", label: "Girls Only" },
];

// Same grading bands used on Reports.jsx / pdfService.js, so a weighted
// average reads the same everywhere in the app.
function overallGrade(avg) {
  if (avg === null || avg === undefined) return "N/A";
  if (avg >= 80) return "EXCELLENT";
  if (avg >= 70) return "VERY GOOD";
  if (avg >= 50) return "PASS";
  return "FAIL";
}

function gradeTone(avg) {
  const grade = overallGrade(avg);
  if (grade === "EXCELLENT") return "pass";
  if (grade === "VERY GOOD") return "pass";
  if (grade === "PASS") return "warning";
  if (grade === "FAIL") return "fail";
  return "neutral";
}

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

function StatCard({ icon: Icon, label, value, tint = "from-brand-400 to-brand-600" }) {
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300">
      <div
        className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${tint} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
      >
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-slate-800 leading-tight">{value}</div>
        {/* Wraps instead of truncating — a clipped label ("Active T...")
            reads as broken/confusing, and these cards have room for two
            short lines. */}
        <div className="text-xs text-slate-500 leading-snug">{label}</div>
      </div>
    </div>
  );
}

// Used for "Best Class" / "Needs Attention" — keeps the caption, the class
// name, and the percentage on their own lines instead of squeezing them
// into one truncated label string (which used to clip mid-name, e.g.
// "Needs Attention — L...").
function ClassHighlightCard({ icon: Icon, caption, className, value, tint, emptyText = "—" }) {
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300">
      <div
        className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${tint} text-white shadow-sm transition-transform duration-200 group-hover:scale-105`}
      >
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{caption}</div>
        {className ? (
          <>
            <div className="text-sm font-semibold text-slate-800 break-words">{className}</div>
            <div className="text-lg font-bold text-slate-800 leading-tight">{value}</div>
          </>
        ) : (
          <div className="text-sm font-semibold text-slate-400 break-words">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

// A simple horizontal split bar — used for boys/girls and pass/fail splits
// without pulling in a charting library.
function SplitBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className="h-2.5 rounded-full bg-slate-100" />;
  }
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
      {segments.map((s, idx) =>
        s.value > 0 ? (
          <div
            key={idx}
            className={s.color}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ) : null
      )}
    </div>
  );
}

// Grouped bar chart (boys vs girls, one group per selected academic year),
// drawn as plain SVG so the page doesn't need a charting dependency. Bars
// animate in on mount via a CSS transition on their height/y.
function YearsComparisonChart({ years }) {
  const width = 640;
  const height = 300;
  const padding = { top: 24, right: 16, bottom: 40, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...years.map((y) => Math.max(y.boys, y.girls, y.totalStudents)));
  // Round the axis ceiling up to a friendly number so gridlines land on
  // clean values instead of the raw max.
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1));
    return Math.ceil(maxValue / magnitude) * magnitude;
  })();
  const gridLines = 4;

  const groupWidth = chartW / years.length;
  const barWidth = Math.min(34, groupWidth / 4);
  const barGap = 10;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [years.length]);

  function yFor(value) {
    return padding.top + chartH - (value / niceMax) * chartH;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Boys and girls enrollment by academic year">
      {/* Gridlines + axis labels */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const value = (niceMax / gridLines) * i;
        const y = yFor(value);
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94a3b8">
              {Math.round(value)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {years.map((y, idx) => {
        const groupX = padding.left + idx * groupWidth;
        const centerX = groupX + groupWidth / 2;
        const boysX = centerX - barGap / 2 - barWidth;
        const girlsX = centerX + barGap / 2;
        const boysY = mounted ? yFor(y.boys) : padding.top + chartH;
        const girlsY = mounted ? yFor(y.girls) : padding.top + chartH;
        const boysH = mounted ? padding.top + chartH - boysY : 0;
        const girlsH = mounted ? padding.top + chartH - girlsY : 0;

        return (
          <g key={y.academicYearId}>
            <rect
              x={boysX}
              y={boysY}
              width={barWidth}
              height={boysH}
              rx={4}
              fill="#60a5fa"
              style={{ transition: "y 0.6s ease, height 0.6s ease" }}
            />
            {y.boys > 0 && (
              <text x={boysX + barWidth / 2} y={boysY - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#2563eb">
                {y.boys}
              </text>
            )}
            <rect
              x={girlsX}
              y={girlsY}
              width={barWidth}
              height={girlsH}
              rx={4}
              fill="#f472b6"
              style={{ transition: "y 0.6s ease, height 0.6s ease" }}
            />
            {y.girls > 0 && (
              <text x={girlsX + barWidth / 2} y={girlsY - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#db2777">
                {y.girls}
              </text>
            )}
            <text
              x={centerX}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#475569"
            >
              {y.name}
            </text>
            {y.isCurrent && (
              <text x={centerX} y={padding.top + chartH + 31} textAnchor="middle" fontSize="9" fill="#16a34a">
                current
              </text>
            )}
          </g>
        );
      })}

      {/* Axis line */}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + chartH}
        y2={padding.top + chartH}
        stroke="#cbd5e1"
        strokeWidth={1}
      />
    </svg>
  );
}

// Small up/down/flat indicator comparing the latest selected year to the
// one before it, e.g. "+12 vs 2026-2027".
function TrendBadge({ current, previous, label }) {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null;
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
  const tone = diff > 0 ? "text-emerald-600 bg-emerald-50" : diff < 0 ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon size={11} />
      {diff > 0 ? "+" : ""}
      {diff}
      {pct !== null && ` (${pct > 0 ? "+" : ""}${pct}%)`}
      <span className="text-slate-400 font-normal">{label}</span>
    </span>
  );
}

// Simple, clearly-labeled comparison: for each metric (average score, pass
// rate) show one bar for boys and one for girls, each with its own label
// and percentage — same visual language as the "Boys & Girls" enrollment
// split above, so it reads the same way instead of introducing a new,
// harder-to-parse chart style.
function GenderPerformanceCompare({ boys, girls }) {
  if (!boys || !girls || (boys.studentsRanked === 0 && girls.studentsRanked === 0)) return null;

  const metrics = [
    { key: "average", label: "Average Score", boysVal: boys.average, girlsVal: girls.average },
    { key: "passRate", label: "Pass Rate", boysVal: boys.passRate, girlsVal: girls.passRate },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 mb-6">
      <h4 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
        <Trophy size={15} className="text-violet-500" /> Boys vs Girls — Academic Performance
      </h4>
      <p className="text-xs text-slate-400 mb-4">
        How boys and girls compare on average score and pass rate for this term.
      </p>

      <div className="space-y-5">
        {metrics.map((m) => {
          const max = Math.max(m.boysVal || 0, m.girlsVal || 0, 1);
          return (
            <div key={m.key}>
              <p className="text-xs font-semibold text-slate-600 mb-2">{m.label}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    <Mars size={12} /> Boys
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-blue-400 transition-all duration-500"
                      style={{ width: `${m.boysVal ? (m.boysVal / max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700 tabular-nums">
                    {m.boysVal !== null ? `${m.boysVal}%` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 inline-flex items-center gap-1 text-xs font-medium text-pink-600">
                    <Venus size={12} /> Girls
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-pink-400 transition-all duration-500"
                      style={{ width: `${m.girlsVal ? (m.girlsVal / max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700 tabular-nums">
                    {m.girlsVal !== null ? `${m.girlsVal}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-4 flex items-start gap-1.5">
        <Info size={12} className="shrink-0 mt-0.5" />
        Based on {boys.studentsRanked} boys and {girls.studentsRanked} girls who have marks recorded this term.
      </p>
    </div>
  );
}

export default function Statistics() {
  const notify = useNotify();
  const { viewingYearId } = useYear();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedTermId, setSelectedTermId] = useState("");

  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterScope, setRosterScope] = useState("");
  const [rosterGender, setRosterGender] = useState("all");
  const [rosterDownloading, setRosterDownloading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);

  // Year-over-year enrollment comparison ("Compare Academic Years" section).
  const [yearsData, setYearsData] = useState(null);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [selectedYearIds, setSelectedYearIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setYearsLoading(true);
    api
      .get("/statistics/years-comparison")
      .then(({ data }) => {
        if (cancelled) return;
        setYearsData(data.years);
        // Default to the most recent two years so the chart opens already
        // showing a meaningful comparison instead of an empty state.
        setSelectedYearIds(data.years.slice(-2).map((y) => y.academicYearId));
      })
      .catch(() => {
        if (!cancelled) setYearsData([]);
      })
      .finally(() => {
        if (!cancelled) setYearsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleYearSelected(id) {
    setSelectedYearIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort((a, b) => a - b)
    );
  }

  async function load(termId) {
    if (!viewingYearId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/statistics", {
        params: { academicYearId: viewingYearId, ...(termId ? { termId } : {}) },
      });
      setData(data);
      setSelectedTermId(data.term ? String(data.term.id) : "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingYearId]);

  function selectTerm(termId) {
    setSelectedTermId(String(termId));
    load(termId);
  }

  function openRosterModal() {
    setRosterScope("");
    setRosterGender("all");
    setRosterOpen(true);
  }

  // How many active students match the currently selected class + gender
  // filter — null while no class is picked yet, otherwise a number
  // (possibly 0). Reuses the counts we already have from /statistics, so no
  // extra request is needed just to check this.
  function getRosterMatchCount() {
    if (!rosterScope) return null;
    const counts =
      rosterScope === SCHOOL_SCOPE
        ? overview
        : classGenderBreakdown.find((c) => String(c.classId) === rosterScope);
    if (!counts) return null;
    if (rosterGender === "M") return counts.boys;
    if (rosterGender === "F") return counts.girls;
    return counts.totalStudents;
  }

  // Downloads the numbers-only school report (total students, boys, girls,
  // classes, teachers, modules, plus a per-class breakdown) — no student
  // names or personal details, just counts. Separate from the "Get Student
  // List" roster, which is name-level.
  async function downloadSchoolReport() {
    setReportDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${api.defaults.baseURL}/statistics/report/pdf?academicYearId=${viewingYearId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        let message = "Something went wrong while generating the school report.";
        try {
          const body = await res.json();
          message = body?.error?.message || message;
        } catch {
          // ignore parse failure, fall back to default message
        }
        notify({ title: "Download failed", message, tone: "error" });
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "school-report.pdf";
      link.click();
    } finally {
      setReportDownloading(false);
    }
  }

  async function downloadRoster() {
    if (!rosterScope) return;
    setRosterDownloading(true);
    try {
      const params = new URLSearchParams();
      if (rosterScope !== SCHOOL_SCOPE) params.set("classId", rosterScope);
      if (rosterGender !== "all") params.set("gender", rosterGender);
      if (viewingYearId) params.set("academicYearId", viewingYearId);

      const token = localStorage.getItem("token");
      const res = await fetch(`${api.defaults.baseURL}/students/roster/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let message = "Something went wrong while generating the student list.";
        try {
          const body = await res.json();
          message = body?.error?.message || message;
        } catch {
          // ignore parse failure, fall back to default message
        }
        notify({ title: "Download failed", message, tone: "error" });
        return;
      }
      const blob = await res.blob();
      const scopeName =
        rosterScope === SCHOOL_SCOPE
          ? "whole-school"
          : data.classGenderBreakdown.find((c) => String(c.classId) === rosterScope)?.className || "class";
      const genderPart = rosterGender === "all" ? "" : `-${rosterGender === "M" ? "boys" : "girls"}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `students-${scopeName.replace(/\s+/g, "-")}${genderPart}.pdf`;
      link.click();
      setRosterOpen(false);
    } finally {
      setRosterDownloading(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-400">Loading statistics…</p>;
  }

  if (error && !data) {
    return (
      <Card>
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  const { overview, classGenderBreakdown, availableTerms, academicYear, academic } = data;

  const rosterMatchCount = getRosterMatchCount();
  const rosterHasNoMatches = rosterScope !== "" && rosterMatchCount === 0;
  const rosterScopeLabel =
    rosterScope === SCHOOL_SCOPE
      ? "the whole school"
      : classGenderBreakdown.find((c) => String(c.classId) === rosterScope)?.className;
  const rosterNoMatchMessage =
    rosterGender === "all"
      ? `There are no students enrolled in ${rosterScopeLabel}.`
      : `There are no ${rosterGender === "M" ? "boys" : "girls"} in ${rosterScopeLabel}.`;

  const selectedYears = (yearsData || []).filter((y) => selectedYearIds.includes(y.academicYearId));

  return (
    <div>
      <ArchivedYearBanner />
      <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
        <Button variant="secondary" onClick={downloadSchoolReport} disabled={reportDownloading}>
          <FileDown size={16} /> {reportDownloading ? "Generating…" : "Get School Report"}
        </Button>
        <Button variant="secondary" onClick={openRosterModal}>
          <FileDown size={16} /> Get Student List
        </Button>
      </div>

      {/* Overview counters */}
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        School at a Glance
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={GraduationCap} label="Students" value={overview.totalStudents} tint="from-brand-400 to-brand-600" />
        <StatCard icon={Mars} label="Boys" value={overview.boys} tint="from-blue-400 to-blue-600" />
        <StatCard icon={Venus} label="Girls" value={overview.girls} tint="from-pink-400 to-pink-600" />
        <StatCard icon={Layers} label="Classes" value={overview.totalClasses} tint="from-teal-400 to-teal-600" />
        <StatCard icon={Users} label="Active Teachers" value={overview.activeTeachers} tint="from-violet-400 to-violet-600" />
        <StatCard icon={BookOpen} label="Modules" value={overview.totalModules} tint="from-amber-400 to-amber-600" />
      </div>

      {/* Gender breakdown */}
      <AccordionSection
        icon={Users}
        accent="from-blue-400 to-pink-400"
        title="Boys & Girls"
        subtitle={academicYear ? `Current academic year — ${academicYear.name}` : "Enrollment by class"}
      >
        <div className="mb-5">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-1.5">
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <Mars size={14} /> {overview.boys} boys
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-pink-600">
                <Venus size={14} /> {overview.girls} girls
              </span>
            </span>
            <span className="text-slate-400">{overview.totalStudents} total</span>
          </div>
          <SplitBar
            segments={[
              { label: "Boys", value: overview.boys, color: "bg-blue-400" },
              { label: "Girls", value: overview.girls, color: "bg-pink-400" },
            ]}
          />
        </div>

        {classGenderBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400">No classes in the current academic year yet.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Class</Th>
                <Th className="text-center">Students</Th>
                <Th className="text-center">
                  <span className="inline-flex items-center gap-1"><Mars size={13} /> Boys</span>
                </Th>
                <Th className="text-center">
                  <span className="inline-flex items-center gap-1"><Venus size={13} /> Girls</span>
                </Th>
                <Th>Split</Th>
              </tr>
            </Thead>
            <tbody>
              {classGenderBreakdown.map((c) => (
                <tr key={c.classId}>
                  <Td className="font-medium text-slate-800">{c.className}</Td>
                  <Td className="text-center">{c.totalStudents}</Td>
                  <Td className="text-center text-blue-600 font-medium">{c.boys}</Td>
                  <Td className="text-center text-pink-600 font-medium">{c.girls}</Td>
                  <Td>
                    <SplitBar
                      segments={[
                        { label: "Boys", value: c.boys, color: "bg-blue-400" },
                        { label: "Girls", value: c.girls, color: "bg-pink-400" },
                      ]}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </AccordionSection>

      {/* Year-over-year enrollment comparison */}
      <AccordionSection
        icon={BarChart3}
        accent="from-violet-400 to-indigo-500"
        title="Compare Academic Years"
        subtitle="See how enrollment has changed from one academic year to the next."
      >
        {yearsLoading ? (
          <p className="text-sm text-slate-400">Loading years…</p>
        ) : (yearsData || []).length === 0 ? (
          <p className="text-sm text-slate-400">No academic years to compare yet.</p>
        ) : (yearsData || []).length === 1 ? (
          <p className="text-sm text-slate-400">
            Only one academic year exists so far — create a new academic year to start comparing.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {yearsData.map((y) => {
                const active = selectedYearIds.includes(y.academicYearId);
                return (
                  <button
                    key={y.academicYearId}
                    type="button"
                    onClick={() => toggleYearSelected(y.academicYearId)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-200 scale-[1.03]"
                        : "border-2 border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50/60"
                    }`}
                  >
                    {active && <Check size={14} />}
                    {y.name}
                    {y.isCurrent && <Badge tone="pass">current</Badge>}
                  </button>
                );
              })}
            </div>

            {selectedYears.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>Select at least one academic year above to see the comparison.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#60a5fa]" /> Boys
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#f472b6]" /> Girls
                  </span>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 sm:p-4 bg-gradient-to-b from-slate-50/50 to-white mb-5">
                  <YearsComparisonChart years={selectedYears} />
                </div>

                <Table>
                  <Thead>
                    <tr>
                      <Th>Academic Year</Th>
                      <Th className="text-center">Total</Th>
                      <Th className="text-center">
                        <span className="inline-flex items-center gap-1"><Mars size={13} /> Boys</span>
                      </Th>
                      <Th className="text-center">
                        <span className="inline-flex items-center gap-1"><Venus size={13} /> Girls</span>
                      </Th>
                      <Th className="text-center">Classes</Th>
                      <Th>vs. previous selected year</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {selectedYears.map((y, idx) => {
                      const prev = idx > 0 ? selectedYears[idx - 1] : null;
                      return (
                        <tr key={y.academicYearId}>
                          <Td className="font-medium text-slate-800">
                            {y.name}
                            {y.isCurrent && (
                              <span className="ml-2">
                                <Badge tone="pass">current</Badge>
                              </span>
                            )}
                          </Td>
                          <Td className="text-center font-semibold">{y.totalStudents}</Td>
                          <Td className="text-center text-blue-600 font-medium">{y.boys}</Td>
                          <Td className="text-center text-pink-600 font-medium">{y.girls}</Td>
                          <Td className="text-center">{y.totalClasses}</Td>
                          <Td>
                            {prev ? (
                              <div className="flex flex-wrap gap-1.5">
                                <TrendBadge current={y.totalStudents} previous={prev.totalStudents} label="total" />
                                <TrendBadge current={y.boys} previous={prev.boys} label="boys" />
                                <TrendBadge current={y.girls} previous={prev.girls} label="girls" />
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </>
            )}
          </>
        )}
      </AccordionSection>

      {/* Term selector for academic performance stats */}
      <AccordionSection
        icon={Trophy}
        accent="from-amber-400 to-orange-500"
        title="Academic Performance"
        subtitle="Rankings are based on each student's weighted average for the selected term."
        actions={
          availableTerms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTerms.map((t) => {
                const active = String(t.id) === selectedTermId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTerm(t.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-200 scale-[1.04]"
                        : "border-2 border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/60"
                    }`}
                  >
                    {active && <Check size={14} />}
                    {t.name}
                  </button>
                );
              })}
            </div>
          )
        }
      >
        {availableTerms.length === 0 ? (
          <p className="text-sm text-slate-400">No terms available yet — create an academic year first.</p>
        ) : !academic ? (
          <p className="text-sm text-slate-400">Select a term to view rankings.</p>
        ) : academic.studentsRanked === 0 ? (
          <div className="flex items-start gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>No marks have been recorded yet for this term, so rankings aren't available.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard icon={TrendingUp} label="School Average" value={`${academic.schoolAverage}%`} tint="from-emerald-400 to-emerald-600" />
              <StatCard icon={Trophy} label="Pass Rate" value={`${academic.schoolPassRate}%`} tint="from-amber-400 to-amber-600" />
              <ClassHighlightCard
                icon={TrendingUp}
                caption="Best Class"
                className={academic.bestClass?.className}
                value={academic.bestClass ? `${academic.bestClass.average}%` : null}
                tint="from-emerald-400 to-emerald-600"
                emptyText="No ranked classes yet"
              />
              <ClassHighlightCard
                icon={TrendingDown}
                caption="Needs Attention (below 70%)"
                className={academic.weakestClass?.className}
                value={academic.weakestClass ? `${academic.weakestClass.average}%` : null}
                tint="from-red-400 to-red-600"
                emptyText="No class below 70%"
              />
            </div>

            <GenderPerformanceCompare boys={academic.genderPerformance?.boys} girls={academic.genderPerformance?.girls} />

            {/* School-wide top performers — spotlight for the top 2 */}
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <Trophy size={15} className="text-amber-500" /> Best Performers — Whole School
            </h4>
            {academic.topPerformers.length === 0 ? (
              <p className="text-sm text-slate-400 mb-2">No ranked students yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 mb-2">
                {academic.topPerformers.map((s, idx) => {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={s.studentId}
                      className={`relative overflow-hidden rounded-xl border p-4 flex items-center gap-4 ${
                        isFirst
                          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
                          : "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
                      }`}
                    >
                      <div
                        className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ring-4 ${
                          isFirst
                            ? "bg-amber-100 text-amber-600 ring-amber-50"
                            : "bg-slate-200 text-slate-500 ring-slate-50"
                        }`}
                      >
                        {isFirst ? <Crown size={22} /> : <Medal size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-400 mb-0.5">
                          {isFirst ? "1st Place" : "2nd Place"}
                        </p>
                        <p className="font-semibold text-slate-800 break-words">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.className}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-slate-800">{s.weightedAverage}%</p>
                        <Badge tone={gradeTone(s.weightedAverage)}>{overallGrade(s.weightedAverage)}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Per-class breakdown with top 3 learners */}
            <h4 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Class Breakdown</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {academic.classBreakdown.map((c) => (
                <div key={c.classId} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800">{c.className}</span>
                    {c.classAverage !== null ? (
                      <Badge tone={gradeTone(c.classAverage)}>{c.classAverage}% avg</Badge>
                    ) : (
                      <Badge tone="neutral">No marks yet</Badge>
                    )}
                  </div>
                  {c.classAverage !== null && (
                    <p className="text-xs text-slate-500 mb-3">
                      {c.classPassRate}% pass rate · {c.studentsRanked} student{c.studentsRanked === 1 ? "" : "s"} ranked
                    </p>
                  )}
                  {c.topLearners.length === 0 ? (
                    <p className="text-sm text-slate-400">No ranked students yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {c.topLearners.map((s, idx) => (
                        <li key={s.studentId} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <Medal size={14} className={MEDAL_COLORS[idx] || "text-slate-300"} />
                            {s.name}
                          </span>
                          <span className="font-medium text-slate-700">{s.weightedAverage}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </AccordionSection>

      <Modal
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        title="Get Student List"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRosterOpen(false)}>
              {rosterHasNoMatches ? "Close" : "Cancel"}
            </Button>
            {!rosterHasNoMatches && (
              <Button onClick={downloadRoster} disabled={!rosterScope || rosterDownloading}>
                <FileDown size={16} /> {rosterDownloading ? "Generating…" : "Download PDF"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Class">
            <Select value={rosterScope} onChange={(e) => setRosterScope(e.target.value)}>
              <option value="">Select a class</option>
              <option value={SCHOOL_SCOPE}>Whole School (all classes)</option>
              {classGenderBreakdown.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Students">
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((g) => {
                const active = rosterGender === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setRosterGender(g.value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm transition ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {g.value === "M" && <Mars size={14} />}
                    {g.value === "F" && <Venus size={14} />}
                    {g.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {rosterHasNoMatches ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>{rosterNoMatchMessage} Pick a different class or filter to get a list.</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 flex items-start gap-1.5">
              <Info size={13} className="shrink-0 mt-0.5" />
              The list includes each student's ID, name, date of birth and sex — guardian details are left off.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
