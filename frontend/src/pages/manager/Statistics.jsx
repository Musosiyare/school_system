import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
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

function StatCard({ icon: Icon, label, value, tint = "bg-brand-50 text-brand-600" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex items-center gap-3">
      <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${tint}`}>
        <Icon size={18} />
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex items-center gap-3">
      <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${tint}`}>
        <Icon size={18} />
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

export default function Statistics() {
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedTermId, setSelectedTermId] = useState("");

  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterScope, setRosterScope] = useState("");
  const [rosterGender, setRosterGender] = useState("all");
  const [rosterDownloading, setRosterDownloading] = useState(false);

  async function load(termId) {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/statistics", {
        params: termId ? { termId } : {},
      });
      setData(data);
      if (!termId && data.term) setSelectedTermId(String(data.term.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function downloadRoster() {
    if (!rosterScope) return;
    setRosterDownloading(true);
    try {
      const params = new URLSearchParams();
      if (rosterScope !== SCHOOL_SCOPE) params.set("classId", rosterScope);
      if (rosterGender !== "all") params.set("gender", rosterGender);

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

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button variant="secondary" onClick={openRosterModal}>
          <FileDown size={16} /> Get Student List
        </Button>
      </div>

      {/* Overview counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={GraduationCap} label="Students" value={overview.totalStudents} />
        <StatCard icon={Mars} label="Boys" value={overview.boys} tint="bg-blue-50 text-blue-600" />
        <StatCard icon={Venus} label="Girls" value={overview.girls} tint="bg-pink-50 text-pink-600" />
        <StatCard icon={Layers} label="Classes" value={overview.totalClasses} />
        <StatCard icon={Users} label="Active Teachers" value={overview.activeTeachers} tint="bg-violet-50 text-violet-600" />
        <StatCard icon={BookOpen} label="Modules" value={overview.totalModules} />
      </div>

      {/* Gender breakdown */}
      <Card
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
      </Card>

      {/* Term selector for academic performance stats */}
      <Card
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
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
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
              <StatCard icon={TrendingUp} label="School Average" value={`${academic.schoolAverage}%`} tint="bg-emerald-50 text-emerald-600" />
              <StatCard icon={Trophy} label="Pass Rate" value={`${academic.schoolPassRate}%`} tint="bg-amber-50 text-amber-600" />
              <ClassHighlightCard
                icon={TrendingUp}
                caption="Best Class"
                className={academic.bestClass?.className}
                value={academic.bestClass ? `${academic.bestClass.average}%` : null}
                tint="bg-emerald-50 text-emerald-600"
                emptyText="No ranked classes yet"
              />
              <ClassHighlightCard
                icon={TrendingDown}
                caption="Needs Attention (below 70%)"
                className={academic.weakestClass?.className}
                value={academic.weakestClass ? `${academic.weakestClass.average}%` : null}
                tint="bg-red-50 text-red-600"
                emptyText="No class below 70%"
              />
            </div>

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
      </Card>

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
